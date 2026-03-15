from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from google.genai import types
from datetime import datetime, timezone
from extensions import db, collection, chat_collection, client
from models import Event, ChatSession, ChatMessage
import base64
import json
import re

chat_bp = Blueprint('chat', __name__)


def process_chat_message(user_id: str, data_in: dict, stream_callback=None):
    session_id = data_in.get("session_id")
    image_b64 = data_in.get("image")
    user_text = data_in.get("message", "").strip()

    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    day_name = now.strftime("%A")

    if not user_text and not image_b64:
        return {"error": "Empty message"}, 400

    if not session_id:
        return {"error": "Missing session_id"}, 400

    chat_session = db.session.get(ChatSession, session_id)
    if not chat_session:
        title_preview = user_text[:30] if user_text else "Image Shared"
        chat_session = ChatSession(id=session_id, user_id=user_id, title=title_preview)
        db.session.add(chat_session)
        db.session.flush()

    gemini_history = []

    if user_text:
        history_results = chat_collection.query(
            query_texts=[user_text],
            n_results=10,
            where={"$and": [{"user_id": user_id}, {"session_id": str(chat_session.id)}]}
        )
        if history_results['documents'] and history_results['documents'][0]:
            for doc, meta, dist in zip(history_results['documents'][0], history_results['metadatas'][0], history_results['distances'][0]):
                if dist <= 1:
                    role = "user" if meta['role'] == "user" else "model"
                    gemini_history.append(types.Content(role=role, parts=[types.Part.from_text(text=doc)]))

    print(f"GEN history len: {len(gemini_history)}")
    user_db_msg = ChatMessage(session_id=session_id, role='user', content=user_text)
    db.session.add(user_db_msg)
    db.session.flush()

    chat_collection.add(
        ids=[str(chat_session.id) + "_" + str(user_db_msg.id)],
        documents=[user_text],
        metadatas=[{"role": "user", "user_id": str(user_id), "session_id": str(chat_session.id)}]
    )

    context = ""
    if user_text:
        search_results = collection.query(
            query_texts=[user_text],
            n_results=10,
            where={"user_id": str(user_id)}
        )
        relevant_docs = []
        if search_results['documents'] and search_results['documents'][0]:
            print(len(search_results['documents'][0]))
            print(search_results['distances'])
            for doc, distance in zip(search_results['documents'][0], search_results['distances'][0]):
                if distance <= 1.5:
                    relevant_docs.append(doc)

            if relevant_docs:
                context += "\nUse this relevant context from your calendar:\n" + "\n".join(relevant_docs)
                print(context)

    current_parts = []
    if user_text:
        current_parts.append(types.Part.from_text(text=user_text))

    if image_b64:
        if "," in image_b64:
            image_b64 = image_b64.split(",")[1]

        image_data = base64.b64decode(image_b64.strip())
        current_parts.append(types.Part.from_bytes(data=image_data, mime_type="image/jpeg"))

        if not user_text:
            current_parts.insert(0, types.Part.from_text(text="Describe this image."))

    models_to_try = [
        "gemini-flash-latest",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite"
    ]

    ai_reply = None
    last_error = None

    for model_name in models_to_try:
        try:
            print(f"Trying chat with model: {model_name}")
            chat = client.chats.create(
                model=model_name,
                config=types.GenerateContentConfig(
                    system_instruction=f"""
                    You are a helpful student assistant, focus on giving short and clear answers.
                    Note that today's date is : {today_str} ({day_name}).
                    {context}.
                    IMPORTANT: Always format mathematical formulas using standard Markdown code blocks or inline backticks.
                    Example: `x = y^2`. Strictly avoid LaTeX symbols like $, $$.
                    """
                ),
                history=gemini_history
            )

            if stream_callback is not None:
                stream_chunks = []
                try:
                    stream = chat.send_message_stream(message=current_parts)
                    for chunk in stream:
                        chunk_text = getattr(chunk, "text", None)
                        if chunk_text:
                            stream_chunks.append(chunk_text)
                            stream_callback(chunk_text)

                    ai_reply = "".join(stream_chunks).strip()
                    if not ai_reply:
                        raise ValueError("Empty streamed response")
                except Exception as stream_error:
                    print(f"Streaming failed for {model_name}, falling back to non-streaming: {stream_error}")
                    response = chat.send_message(message=current_parts)
                    ai_reply = response.text
            else:
                response = chat.send_message(message=current_parts)
                ai_reply = response.text
            break

        except Exception as e:
            print(f"Model {model_name} failed: {e}")
            last_error = e
            continue

    if not ai_reply:
        return {"error": f"All AI models failed. Last error: {str(last_error)}"}, 500

    try:
        ai_db_msg = ChatMessage(session_id=session_id, role='assistant', content=ai_reply)
        db.session.add(ai_db_msg)
        db.session.flush()
        chat_collection.add(
            ids=[str(chat_session.id) + "_" + str(ai_db_msg.id) + "1"],
            documents=[ai_db_msg.content],
            metadatas=[{"role": "ai", "user_id": str(user_id), "session_id": str(chat_session.id)}]
        )

        db.session.commit()

        return {
            "status": "success",
            "session_id": str(session_id),
            "id": ai_db_msg.id,
            "reply": ai_reply
        }, 200

    except Exception as e:
        db.session.rollback()
        print(f"Error: {e}")
        return {"error": str(e)}, 500


@chat_bp.route('/chat/message', methods=['POST'])
@jwt_required()
def handle_chat():
    user_id = str(get_jwt_identity())
    data_in = request.json or {}
    response, status = process_chat_message(user_id, data_in)
    return jsonify(response), status


@chat_bp.route('/chat/history', methods=['GET'])
@jwt_required()
def get_chat_history():
    user_id = get_jwt_identity()
    sessions = ChatSession.query.filter_by(user_id=user_id).order_by(ChatSession.created_at.desc()).all()

    result = []
    for s in sessions:
        msgs = [{"id": m.id, "role": m.role, "content": m.content} for m in s.messages]
        result.append({"id": s.id, "title": s.title, "date": s.created_at.strftime("%Y-%m-%d"), "messages": msgs})
    return jsonify(result)


@chat_bp.post("/chat/extract-events")
@jwt_required()
def extract_events():
    current_user_id = get_jwt_identity()
    data_in = request.json
    image_b64 = data_in.get("image")

    if not image_b64:
        return jsonify({"error": "No image provided"}), 400

    if "," in image_b64:
        image_b64 = image_b64.split(",")[1]
    image_data = base64.b64decode(image_b64.strip())

    prompt = (
        "Analyze this school-related image. Extract events and return them in a JSON format. If the image is NOT a school schedule or contains no relevant tasks, return an empty list for 'events'!!!"
        "Rules: "
        "1. 'date' must be in 'YYYY-MM-DD' format. "
        "2. 'type' must be EXACTLY one of these strings: 'homework', 'test', 'project'. "
        "3. 'description' should be a short Bulgarian summary of the task. "
        "Format: {'events': [{'date': '...', 'type': '...', 'description': '...'}]}"
    )

    extracted = None
    last_error = None

    models_to_try = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']
    for model_name in models_to_try:
        try:
            print(f"Trying extraction with model: {model_name}")
            response = client.models.generate_content(
                model=model_name,
                contents=[
                    types.Part.from_bytes(data=image_data, mime_type="image/jpeg"),
                    prompt
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )

            raw_text = response.text.strip()
            if raw_text.startswith("```"):
                raw_text = raw_text.split("```")[1]
                if raw_text.startswith("json"):
                    raw_text = raw_text[4:]

            extracted = json.loads(raw_text)
            break

        except Exception as e:
            print(f"Model {model_name} failed: {e}")
            last_error = e
            continue

    if not extracted:
        return jsonify({"error": f"AI extraction failed on all models: {str(last_error)}"}), 500

    try:
        added_events = []
        print(extracted)
        for item in extracted.get("events", []):
            new_event = Event(
                user_id=current_user_id,
                date=item['date'],
                type=item['type'],
                description=item['description']
            )
            db.session.add(new_event)
            db.session.flush()

            collection.add(
                ids=[str(new_event.id)],
                documents=[f"Date: {item['date']}, Type: {item['type']}, Task: {item['description']}"],
                metadatas=[{"user_id": str(current_user_id)}]
            )
            added_events.append(item)
            print("Event added")

        db.session.commit()

        return jsonify({
            "status": "success",
            "message": f"Added {len(added_events)} events to your calendar",
            "events": added_events
        })
    except Exception as e:
        print(f"AI Extraction Error: {e}")
        db.session.rollback()
        return jsonify({"error": "Could not process image"}), 500


@chat_bp.route('/chat/generate-test', methods=['POST'])
@jwt_required()
def generate_test():
    data = request.json
    subject = data.get('subject', 'General Topic')
    context = data.get('context', '')
    questionsCount = data.get('questionsCount', 5)
    images = data.get('images', [])

    if not context and not images:
        return jsonify({"error": "No study material provided"}), 400

    prompt = f"""
    You are an expert teacher. Create a multiple-choice quiz based ONLY on the following study material.

    IMPORTANT: I have provided study materials as TEXT and/or IMAGES. 
    Please analyze both carefully. If there are images (like handwritten notes or diagrams), 
    prioritize the information found in them.

    Subject: {subject}
    Study Material: {context}

    Return exactly {questionsCount} questions in valid JSON format. 
    Each question must have:
    - "question": the text of the question
    - "options": an array of 4 possible answers
    - "correct": the text of the correct answer (must match one of the options exactly)

    Response format:
    {{
        "questions": [
            {{
                "question": "example",
                "options": ["a", "b", "c", "d"],
                "correct": "a"
            }}
        ]
    }}
    """

    contents = [types.Part.from_text(text=prompt)]

    for img_base64 in images:
        image_b64 = ''
        if "," in img_base64:
            image_b64 = img_base64.split(",")[1]
        else:
            image_b64 = img_base64

        image_data = base64.b64decode(image_b64.strip())
        contents.append(
            types.Part.from_bytes(data=image_data, mime_type='image/jpeg')
        )

    try:
        response = client.models.generate_content(
            model="gemini-flash-latest",
            contents=contents
        )

        raw_text = response.text
        json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)

        if json_match:
            quiz_data = json.loads(json_match.group())
            return jsonify(quiz_data)
        else:
            return jsonify({"error": "AI returned invalid format"}), 500

    except Exception as e:
        print(f"Error generating test: {e}")
        return jsonify({"error": "Failed to connect to AI"}), 500

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from google.genai import types
from extensions import db, client
from models import Score, SchoolworkAnalysis
import base64

schoolwork_bp = Blueprint('schoolwork', __name__)


@schoolwork_bp.route('/chat/analyze-schoolwork', methods=['POST'])
@jwt_required()
def analyze_schoolwork():
    user_id = get_jwt_identity()
    data = request.json

    work_type = data.get('type')
    subject = data.get('subject')

    grade = data.get('grade')
    mistakes = data.get('mistakes')
    notes = data.get('notes')
    topic = data.get('topic')
    images = data.get('images', [])

    if not work_type or not subject:
        return jsonify({"error": "Missing type or subject"}), 400

    subject_term = subject.lower().strip()
    all_scores = Score.query.filter_by(user_id=user_id).all()

    relevant_scores = []
    for s in all_scores:
        db_subj = s.subject.lower()
        if subject_term in db_subj or db_subj in subject_term:
            relevant_scores.append(s)

    relevant_scores.sort(key=lambda x: x.timestamp, reverse=True)
    relevant_scores = relevant_scores[:5]

    score_summary = "\n".join([f"- {s.subject}: {s.score_value}/{s.total}" for s in relevant_scores])

    prompt = f"""
    You are an expert academic tutor. Analyze the following schoolwork and provide insights, resources, and advice.
    
    User Context (Past Performance in {subject}):
    {score_summary if score_summary else f"No specific past test data found for {subject}."}

    Current Schoolwork Info:
    - Type: {work_type}
    - Subject: {subject}
    """

    if work_type == 'past_exam':
        prompt += f"""
        - Grade: {grade}
        - User Notes: {notes}
        - Mistakes/Weaknesses described: {mistakes}
        
        Please provide:
        1. Analysis of the mistakes (if provided).
        2. Specific study tips to improve from this grade.
        3. 3-5 useful links or search terms.
        """
    elif work_type == 'project':
        prompt += f"""
        - Topic: {topic}
        - User Notes: {notes}
        
        Please provide:
        1. Creative ideas or structure suggestions.
        2. Key points to cover for a high grade.
        3. Useful resources/references.
        """
    elif work_type == 'homework':
        prompt += f"""
        - Topic: {topic}
        - Key Notes: {notes}
        
        Please provide:
        1. Explanation of the key concepts.
        2. Step-by-step guidance.
        3. Further reading.
        """

    prompt += "\n\nIMPORTANT FORMATTING RULES:\n"
    prompt += "1. Use clear Markdown headings (##, ###).\n"
    prompt += "2. When providing links, they MUST be clickable Markdown links. Format: `[Title](URL)`.\n"
    prompt += "3. Ensure the tone is encouraging but highly practical.\n"
    prompt += "4. If you suggest resources, provide REAL valid URLs or specific search queries formatted as `[Search for Topic](https://www.google.com/search?q=Topic)` if a direct link is unavailable.\n"

    contents = [types.Part.from_text(text=prompt)]

    for img_base64 in images:
        if not img_base64:
            continue
        image_b64 = ''
        if "," in img_base64:
            image_b64 = img_base64.split(",")[1]
        else:
            image_b64 = img_base64

        try:
            image_data = base64.b64decode(image_b64.strip())
            contents.append(
                types.Part.from_bytes(data=image_data, mime_type='image/jpeg')
            )
        except Exception as e:
            print(f"Image decode error: {e}")

    try:
        response = client.models.generate_content(
            model="gemini-flash-latest",
            contents=contents
        )
        ai_text = response.text

        new_analysis = SchoolworkAnalysis(
            user_id=user_id,
            type=work_type,
            subject=subject,
            topic=topic or "",
            content=ai_text
        )
        db.session.add(new_analysis)
        db.session.commit()

        return jsonify({"analysis": ai_text, "id": new_analysis.id})

    except Exception as e:
        print(f"Error analyzing schoolwork: {e}")
        db.session.rollback()
        return jsonify({"error": "Failed to connect to AI"}), 500


@schoolwork_bp.route('/schoolwork/recents', methods=['GET'])
@jwt_required()
def get_recent_schoolwork():
    user_id = get_jwt_identity()
    recents = SchoolworkAnalysis.query.filter_by(user_id=user_id).order_by(
        SchoolworkAnalysis.created_at.desc()
    ).limit(10).all()

    result = []
    for r in recents:
        result.append({
            "id": r.id,
            "type": r.type,
            "subject": r.subject,
            "topic": r.topic,
            "date": r.created_at.strftime("%Y-%m-%d"),
            "preview": r.content[:100] + "..."
        })
    return jsonify(result)


@schoolwork_bp.route('/schoolwork/<int:id>', methods=['GET'])
@jwt_required()
def get_schoolwork_detail(id):
    user_id = get_jwt_identity()
    item = db.session.get(SchoolworkAnalysis, id)
    if not item or item.user_id != int(user_id):
        return jsonify({"error": "Not found"}), 404

    return jsonify({
        "id": item.id,
        "type": item.type,
        "subject": item.subject,
        "topic": item.topic,
        "content": item.content,
        "date": item.created_at.strftime("%Y-%m-%d")
    })

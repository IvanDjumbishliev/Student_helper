from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db, collection
from models import Event

calendar_bp = Blueprint('calendar', __name__)


@calendar_bp.route('/events', methods=['GET'])
@jwt_required()
def get_events():
    current_user_id = get_jwt_identity()
    events_from_db = Event.query.filter_by(user_id=current_user_id).all()
    events_by_date = {}

    for event in events_from_db:
        if event.date not in events_by_date:
            events_by_date[event.date] = []
        events_by_date[event.date].append({
            "id": event.id,
            "type": event.type,
            "description": event.description
        })

    return jsonify(events_by_date)


@calendar_bp.route('/events', methods=['POST'])
@jwt_required()
def create_event():
    current_user_id = get_jwt_identity()
    data = request.get_json()
    date = data.get("date")
    event_type = data.get("type")
    description = data.get("description")

    if not date or not event_type or not description:
        return {"message": "Missing required fields"}, 400

    if event_type not in ["homework", "test", "project"]:
        return {"message": "Invalid event type"}, 400

    new_event = Event(
        user_id=current_user_id,
        date=date,
        type=event_type,
        description=description
    )

    try:
        db.session.add(new_event)
        db.session.commit()

        collection.add(
            ids=[str(new_event.id)],
            documents=[f"Date: {new_event.date}, Task: {new_event.description}"],
            metadatas=[{"user_id": str(current_user_id)}]
        )
        print("Event added")
        return {
            "message": "Event created successfully",
            "data": {
                "id": new_event.id,
                "date": new_event.date,
                "type": new_event.type,
                "description": new_event.description
            }
        }, 201
    except Exception as e:
        db.session.rollback()
        return {"message": "Failed to create event", "error": str(e)}, 500


@calendar_bp.route('/events/delete', methods=['POST'])
@jwt_required()
def delete_event():
    current_user_id = get_jwt_identity()
    data = request.get_json()

    event_id = data.get('id')
    date = data.get('date')
    description = data.get('description')

    print(f"DELETE REQUEST: id={event_id}, date={date}, desc={description}")

    event_to_delete = None

    if event_id:
        print(f"Attempting delete by ID: {event_id}")
        event_to_delete = Event.query.filter_by(id=event_id, user_id=current_user_id).first()
    elif date and description:
        print(f"Attempting delete by Date/Desc (Fallback): {date}, {description}")
        event_to_delete = Event.query.filter_by(
            user_id=current_user_id,
            date=date,
            description=description
        ).first()
    else:
        print("Missing deletion criteria")
        return jsonify({"error": "Missing event ID, or date and description"}), 400

    if not event_to_delete:
        print("Event not found in DB")
        return jsonify({"error": "Event not found"}), 404

    try:
        print(f"Deleting event: {event_to_delete.id}")
        db.session.delete(event_to_delete)
        db.session.commit()

        collection.delete(ids=[str(event_to_delete.id)])

        return jsonify({"success": True, "message": "Event deleted"}), 200
    except Exception as e:
        print(f"Delete Exception: {e}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

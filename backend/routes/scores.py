from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func, cast, Float
from extensions import db
from models import Score

scores_bp = Blueprint('scores', __name__)


@scores_bp.route('/save-score', methods=['POST'])
@jwt_required()
def save_score():
    user_id = get_jwt_identity()
    data = request.json

    subject = data.get('subject')
    score_value = data.get('score')
    total = data.get('total')
    print(total)
    new_entry = Score(
        user_id=user_id,
        subject=subject,
        score_value=score_value,
        total=total
    )

    db.session.add(new_entry)
    db.session.commit()
    return jsonify({"message": "Score saved!", "id": new_entry.id}), 201


@scores_bp.route('/recent-scores', methods=['GET'])
@jwt_required()
def get_user_stats():
    user_id = get_jwt_identity()

    stats = db.session.query(
        func.count(Score.id).label('total_tests'),
        func.avg(cast(Score.score_value, Float) / Score.total).label('avg_score')
    ).filter(Score.user_id == user_id).first()

    avg_perc = round((stats.avg_score or 0) * 100, 1)

    return jsonify({
        "total_tests": stats.total_tests or 0,
        "avg_percentage": avg_perc
    })

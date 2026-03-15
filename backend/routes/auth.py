from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from extensions import db
from models import User

auth_bp = Blueprint('auth', __name__)


@auth_bp.post("/auth/register")
def register():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if not isinstance(email, str) or not isinstance(password, str):
        return {"message": "Invalid input"}, 400

    if User.query.filter_by(email=email).first():
        return {"message": "User already exists"}, 400

    user = User(email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return {"message": "User created successfully"}, 201


@auth_bp.post("/auth/login")
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if not isinstance(email, str) or not isinstance(password, str):
        return {"message": "Invalid input"}, 400

    if not email or not password:
        return {"message": "Missing credentials"}, 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return {"message": "Invalid credentials"}, 401

    token = create_access_token(identity=str(user.id))
    return {"access_token": token}


@auth_bp.get("/auth/myInfo")
@jwt_required()
def get_current_user():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)

    if not user:
        return {"message": "User not found"}, 404

    return {"id": user.id, "email": user.email, "profile_pic": user.profile_pic}


@auth_bp.post("/auth/update_profile_pic")
@jwt_required()
def update_profile_pic():
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    if not user:
        return {"message": "User not found"}, 404

    data = request.get_json()
    profile_pic = data.get("profile_pic")

    user.profile_pic = profile_pic
    db.session.commit()

    return {"message": "Profile picture updated successfully"}


@auth_bp.post("/auth/change_password")
@jwt_required()
def change_password():
    data = request.get_json()
    new_password = data.get("password")

    if not isinstance(new_password, str):
        return {"message": "Invalid password"}, 400

    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)

    if not user:
        return {"message": "User not found"}, 404

    user.set_password(new_password)
    db.session.commit()

    return {"message": "Password updated successfully"}

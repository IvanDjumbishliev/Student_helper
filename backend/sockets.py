from flask import request
from flask_jwt_extended import decode_token
from flask_socketio import emit, disconnect
from extensions import socketio, active_socket_users
from routes.chat import process_chat_message


@socketio.on("connect")
def socket_connect(auth):
    token = None
    if isinstance(auth, dict):
        token = auth.get("token")

    if not token:
        token = request.args.get("token")

    if not token:
        print("Socket rejected: missing token")
        return False

    try:
        decoded = decode_token(token)
        user_id = str(decoded.get("sub"))
        if not user_id:
            return False

        active_socket_users[request.sid] = user_id
        print(f"Socket connected sid={request.sid} user={user_id}")
        emit("chat:connected", {"status": "ok"})
    except Exception as e:
        print(f"Socket rejected: invalid token ({e})")
        return False


@socketio.on("disconnect")
def socket_disconnect():
    active_socket_users.pop(request.sid, None)


@socketio.on("chat:send")
def socket_chat_send(payload):
    user_id = active_socket_users.get(request.sid)
    if not user_id:
        emit("chat:error", {"error": "Unauthorized"})
        disconnect()
        return

    data_in = payload or {}
    session_id = data_in.get("session_id")

    if session_id:
        emit("chat:stream:start", {"session_id": str(session_id)})

    def stream_to_client(chunk_text):
        emit("chat:stream:chunk", {
            "session_id": str(session_id) if session_id else None,
            "chunk": chunk_text
        })

    response, status = process_chat_message(user_id, data_in, stream_callback=stream_to_client)
    if status >= 400:
        emit("chat:error", response)
        return

    emit("chat:stream:end", response)

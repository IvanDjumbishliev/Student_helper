try:
    __import__('pysqlite3')
    import sys
    sys.modules['sqlite3'] = sys.modules.pop('pysqlite3')
except ImportError:
    pass

from dotenv import load_dotenv
load_dotenv()

from flask import Flask
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
from sqlalchemy.pool import NullPool
from datetime import timedelta
import os

from extensions import db, jwt, socketio, chroma_client, sentence_transformer_ef
from models import Event
import sockets 

from routes.auth import auth_bp
from routes.calendar import calendar_bp
from routes.chat import chat_bp
from routes.schoolwork import schoolwork_bp
from routes.scores import scores_bp

app = Flask(__name__)
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config["JWT_SECRET_KEY"] = os.environ.get('JWT_SECRET_KEY')
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=7)
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    "poolclass": NullPool,
    "connect_args": {
        "prepare_threshold": None
    }
}

db.init_app(app)
jwt.init_app(app)
socketio.init_app(app, cors_allowed_origins="*", async_mode="threading")

app.register_blueprint(auth_bp)
app.register_blueprint(calendar_bp)
app.register_blueprint(chat_bp)
app.register_blueprint(schoolwork_bp)
app.register_blueprint(scores_bp)


@app.errorhandler(Exception)
def handle_exception(e):
    if isinstance(e, HTTPException):
        return e

    print(f"SERVER CRASH: {e}")

    return {"error": "An unexpected error occurred on the server"}, 500


with app.app_context():
    db.create_all()

    collection = chroma_client.get_or_create_collection(
        name="user_events",
        embedding_function=sentence_transformer_ef
    )

    if collection.count() == 0:
        print("ChromaDB is empty. Syncing from SQL...")
        all_events = Event.query.all()
        if all_events:
            collection.add(
                ids=[str(e.id) for e in all_events],
                documents=[f"Date: {e.date}, Type: {e.type}, Task: {e.description}" for e in all_events],
                metadatas=[{"user_id": str(e.user_id)} for e in all_events]
            )
            print(f"Synced {len(all_events)} events to ChromaDB.")
    else:
        print(f"ChromaDB already contains {collection.count()} events. Skipping sync.")

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, allow_unsafe_werkzeug=True)


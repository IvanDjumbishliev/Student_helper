from dotenv import load_dotenv
load_dotenv()

from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from google import genai
import chromadb
from chromadb.utils import embedding_functions
import os

db = SQLAlchemy()
jwt = JWTManager()
socketio = SocketIO()


active_socket_users: dict = {}

chroma_client = chromadb.PersistentClient(path="./chroma_db")
sentence_transformer_ef = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)
collection = chroma_client.get_or_create_collection(
    name="user_events",
    embedding_function=sentence_transformer_ef
)
chat_collection = chroma_client.get_or_create_collection(
    name="chat_history",
    embedding_function=sentence_transformer_ef
)

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

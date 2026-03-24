"""Socket.IO instance for real-time updates."""
import os
from dotenv import load_dotenv
from flask_socketio import SocketIO

load_dotenv()

raw_origins = os.getenv("CORS_ORIGIN", "http://localhost:5173")
cors_allowed_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
if not cors_allowed_origins:
	cors_allowed_origins = ["http://localhost:5173"]

socketio = SocketIO(
	async_mode="eventlet",
	cors_allowed_origins=cors_allowed_origins,
)

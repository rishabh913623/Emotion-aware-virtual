import eventlet
eventlet.monkey_patch()

"""Flask application entry point for Emotion Aware Virtual Classroom."""

import os
import logging
from datetime import datetime, timezone
from threading import RLock

from dotenv import load_dotenv
import jwt
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import emit, join_room, leave_room
from werkzeug.exceptions import HTTPException

from routes.predict import predict_bp
from routes.emotions import emotions_bp
from routes.quiz import quiz_bp
from routes.auth import auth_bp
from socketio_instance import socketio
from utils.model import preload_models


# ------------------ LOGGING ------------------
logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)

room_participants = {}
sid_to_room = {}
sid_user = {}
room_lock = RLock()


# ------------------ CORS ------------------
def parse_allowed_origins():
    raw = os.getenv(
        "CORS_ORIGIN",
        "http://localhost:5173,http://localhost:5174"
    )
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    return origins or ["http://localhost:5173"]


def decode_socket_token(token):
    if not token:
        return {}
    secret = os.getenv("JWT_SECRET", "dev_secret")
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        return payload if isinstance(payload, dict) else {}
    except jwt.PyJWTError:
        logger.warning("Socket token decode failed")
        return {}


def get_room_participants(room_id):
    with room_lock:
        participants_map = room_participants.get(room_id, {})
        return list(participants_map.values())


# ------------------ APP FACTORY ------------------
def create_app():
    load_dotenv()

    app = Flask(__name__)

    # CORS config
    cors_origins = parse_allowed_origins()
    CORS(app, origins=cors_origins)
    logger.info("CORS origins: %s", cors_origins)

    # Register routes
    app.register_blueprint(predict_bp)
    app.register_blueprint(emotions_bp)
    app.register_blueprint(quiz_bp)
    app.register_blueprint(auth_bp)

    # SocketIO init (important fix)
    socketio.init_app(app, cors_allowed_origins="*")

    # ------------------ MODEL LOADING (SAFE) ------------------
    try:
        preload_report = preload_models()
        logger.info("Model preload status: %s", preload_report)
    except Exception as e:
        logger.error("Model preload failed: %s", str(e))

    # ------------------ ROUTES ------------------

    @app.route("/", methods=["GET"])
    def home():
        return jsonify({"message": "Backend running"})

    @app.route("/health", methods=["GET"])
    def health_check():
        return jsonify({"status": "ok"})

    @app.route("/test", methods=["GET"])
    def test():
        return jsonify({"message": "Test route working"})

    # ------------------ SOCKET EVENTS ------------------

    @socketio.on("connect")
    def on_connect(auth=None):
        auth_payload = auth if isinstance(auth, dict) else {}
        token = auth_payload.get("token")
        user_payload = decode_socket_token(token)
        sid_user[request.sid] = {
            "id": user_payload.get("id") or user_payload.get("user_id") or user_payload.get("student_id") or request.sid,
            "name": user_payload.get("name") or user_payload.get("username") or f"Participant {request.sid[:4]}",
            "role": user_payload.get("role") or "student",
        }
        logger.info(
            "Socket connected | sid=%s | origin=%s",
            request.sid,
            request.headers.get("Origin"),
        )

    @socketio.on("join-room")
    @socketio.on("room:join")
    def on_join_room(data):
        payload = data or {}
        room_id = payload.get("roomId")
        client_user = sid_user.get(request.sid, {})

        if not room_id:
            emit("room:error", {"error": "roomId is required"})
            return

        with room_lock:
            previous_room = sid_to_room.get(request.sid)
            if previous_room and previous_room != room_id:
                leave_room(previous_room)
                if previous_room in room_participants:
                    room_participants[previous_room].pop(request.sid, None)
                    if not room_participants[previous_room]:
                        room_participants.pop(previous_room, None)
                emit(
                    "room:user-left",
                    {"socketId": request.sid, "userId": client_user.get("id")},
                    to=previous_room,
                )
                emit("room:participants", get_room_participants(previous_room), to=previous_room)

            existing_participants = get_room_participants(room_id)

            join_room(room_id)

            participant = {
                "socketId": request.sid,
                "userId": payload.get("userId") or client_user.get("id") or request.sid,
                "name": payload.get("name") or client_user.get("name") or f"Participant {request.sid[:4]}",
                "role": payload.get("role") or client_user.get("role") or "student",
                "isMuted": False,
                "isCameraOff": False,
                "isSharingScreen": False,
            }

            if room_id not in room_participants:
                room_participants[room_id] = {}

            room_participants[room_id][request.sid] = participant
            sid_to_room[request.sid] = room_id

        logger.info("Joining room: %s | sid=%s", room_id, request.sid)

        emit("room:participants", existing_participants, to=request.sid)
        emit("user-connected", participant, to=room_id, include_self=False)
        emit("room:user-joined", participant, to=room_id, include_self=False)
        emit("room:participants", get_room_participants(room_id), to=room_id)

    @socketio.on("signal:offer")
    @socketio.on("offer")
    def on_offer(data):
        payload = data or {}
        target_socket_id = payload.get("targetSocketId") or payload.get("to")
        sdp = payload.get("sdp") or payload.get("offer")
        if not target_socket_id or not sdp:
            return

        logger.info("Offer sent | from=%s | to=%s", request.sid, target_socket_id)
        offer_payload = {"fromSocketId": request.sid, "from": request.sid, "sdp": sdp, "offer": sdp}
        emit("signal:offer", offer_payload, to=target_socket_id)
        emit("offer", offer_payload, to=target_socket_id)

    @socketio.on("signal:answer")
    @socketio.on("answer")
    def on_answer(data):
        payload = data or {}
        target_socket_id = payload.get("targetSocketId") or payload.get("to")
        sdp = payload.get("sdp") or payload.get("answer")
        if not target_socket_id or not sdp:
            return

        logger.info("Answer sent | from=%s | to=%s", request.sid, target_socket_id)
        answer_payload = {"fromSocketId": request.sid, "from": request.sid, "sdp": sdp, "answer": sdp}
        emit("signal:answer", answer_payload, to=target_socket_id)
        emit("answer", answer_payload, to=target_socket_id)

    @socketio.on("signal:ice-candidate")
    @socketio.on("ice-candidate")
    def on_ice_candidate(data):
        payload = data or {}
        target_socket_id = payload.get("targetSocketId") or payload.get("to")
        candidate = payload.get("candidate")
        if not target_socket_id or not candidate:
            return

        logger.info("ICE candidate exchanged | from=%s | to=%s", request.sid, target_socket_id)
        ice_payload = {"fromSocketId": request.sid, "from": request.sid, "candidate": candidate}
        emit("signal:ice-candidate", ice_payload, to=target_socket_id)
        emit("ice-candidate", ice_payload, to=target_socket_id)

    @socketio.on("chat:message")
    def on_chat_message(data):
        payload = data or {}
        room_id = payload.get("roomId")
        message = payload.get("message")
        if not room_id or not message:
            return

        user = sid_user.get(request.sid, {})
        emit(
            "chat:message",
            {
                "id": f"{int(datetime.now(tz=timezone.utc).timestamp() * 1000)}-{request.sid}",
                "sender": user.get("name") or f"Participant {request.sid[:4]}",
                "senderRole": user.get("role") or "student",
                "message": message,
                "timestamp": datetime.now(tz=timezone.utc).isoformat(),
            },
            to=room_id,
        )

    @socketio.on("room:update-state")
    def on_room_update_state(data):
        payload = data or {}
        room_id = payload.get("roomId")
        patch = payload.get("patch") or {}
        if not room_id:
            return

        with room_lock:
            participants = room_participants.get(room_id, {})
            participant = participants.get(request.sid)
            if participant:
                participant.update(patch)

        emit("room:participants", get_room_participants(room_id), to=room_id)

    @socketio.on("room:moderation")
    def on_room_moderation(data):
        payload = data or {}
        room_id = payload.get("roomId")
        action = payload.get("action")
        target_socket_id = payload.get("targetSocketId")
        if not room_id or not action or not target_socket_id:
            return

        actor = sid_user.get(request.sid, {})
        if actor.get("role") != "instructor":
            return

        if action == "mute":
            emit("room:force-muted", {"by": actor.get("name", "Instructor")}, to=target_socket_id)
        elif action == "remove":
            emit("room:removed", {"by": actor.get("name", "Instructor")}, to=target_socket_id)
            leave_room(room_id, sid=target_socket_id)

            with room_lock:
                if room_id in room_participants:
                    removed = room_participants[room_id].pop(target_socket_id, None)
                    if removed:
                        sid_to_room.pop(target_socket_id, None)
                    if not room_participants[room_id]:
                        room_participants.pop(room_id, None)

            emit("room:user-left", {"socketId": target_socket_id}, to=room_id)
            emit("room:participants", get_room_participants(room_id), to=room_id)

    @socketio.on("disconnect")
    def on_disconnect():
        left_room = None
        with room_lock:
            left_room = sid_to_room.pop(request.sid, None)
            if left_room and left_room in room_participants:
                room_participants[left_room].pop(request.sid, None)
                if not room_participants[left_room]:
                    room_participants.pop(left_room, None)
        sid_user.pop(request.sid, None)

        if left_room:
            emit("room:user-left", {"socketId": request.sid}, to=left_room)
            emit("room:participants", get_room_participants(left_room), to=left_room)
            logger.info("Socket disconnected | sid=%s | room=%s", request.sid, left_room)
        else:
            logger.info("Socket disconnected | sid=%s", request.sid)

    # ------------------ ERROR HANDLING ------------------

    @app.errorhandler(Exception)
    def handle_error(e):
        if isinstance(e, HTTPException):
            return jsonify({"error": e.description}), e.code

        logger.exception("Unhandled server error: %s", str(e))
        return jsonify({"error": str(e)}), 500

    return app


# ------------------ CREATE APP ------------------
app = create_app()


# ------------------ RUN ------------------
if __name__ == "__main__":
    socketio.run(
        app,
        host="0.0.0.0",
        port=int(os.getenv("PORT", 10000)),
        debug=False,
        use_reloader=False,
    )
    
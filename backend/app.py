"""Flask application entry point for Emotion Aware Virtual Classroom."""

import os
import logging
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
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


# ------------------ CORS ------------------
def parse_allowed_origins():
    raw = os.getenv(
        "CORS_ORIGIN",
        "http://localhost:5173,http://localhost:5174"
    )
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    return origins or ["http://localhost:5173"]


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
    def on_connect():
        logger.info(
            "Socket connected | sid=%s | origin=%s",
            request.sid,
            request.headers.get("Origin"),
        )

    @socketio.on("disconnect")
    def on_disconnect():
        logger.info("Socket disconnected | sid=%s", request.sid)

    # ------------------ ERROR HANDLING ------------------

    @app.errorhandler(Exception)
    def handle_error(e):
        if isinstance(e, HTTPException):
            return jsonify({"error": e.description}), e.code

        logger.exception("Unhandled server error: %s", str(e))
        return jsonify({"error": "Internal server error"}), 500

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
    
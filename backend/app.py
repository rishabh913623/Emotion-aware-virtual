"""Flask application entry point for Emotion Aware Virtual Classroom."""
import os
import logging
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from routes.predict import predict_bp
from routes.emotions import emotions_bp
from routes.quiz import quiz_bp
from routes.auth import auth_bp
from socketio_instance import socketio
from utils.model import preload_models


logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)


def parse_allowed_origins() -> list[str]:
    """Parse CORS origins from env; fallback to local dev origin."""
    raw_origins = os.getenv("CORS_ORIGIN", "http://localhost:5173")
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    return origins or ["http://localhost:5173"]


def create_app() -> Flask:
    """Create and configure the Flask application."""
    load_dotenv()

    app = Flask(__name__)
    cors_origins = parse_allowed_origins()
    CORS(app, origins=cors_origins)
    logger.info("Configured CORS origins: %s", cors_origins)

    app.register_blueprint(predict_bp)
    app.register_blueprint(emotions_bp)
    app.register_blueprint(quiz_bp)
    app.register_blueprint(auth_bp)

    socketio.init_app(app)

    preload_report = preload_models()
    logger.info("Model preload status: %s", preload_report)

    @app.route("/health", methods=["GET"])
    def health_check():
        """Lightweight health check."""
        return jsonify({"status": "ok"})

    @app.errorhandler(Exception)
    def handle_uncaught_exception(exc):
        logger.exception("Unhandled server error: %s", exc)
        return jsonify({"error": "Internal server error"}), 500

    return app


app = create_app()

if __name__ == "__main__":
    socketio.run(
        app,
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 10000)),
        debug=False,
        use_reloader=False,
    )

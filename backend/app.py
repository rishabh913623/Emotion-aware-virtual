"""Flask application entry point for Emotion Aware Virtual Classroom."""
import os
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from routes.predict import predict_bp
from routes.emotions import emotions_bp
from routes.quiz import quiz_bp
from routes.auth import auth_bp
from socketio_instance import socketio


def create_app() -> Flask:
    """Create and configure the Flask application."""
    load_dotenv()

    app = Flask(__name__)
    CORS(app)

    app.register_blueprint(predict_bp)
    app.register_blueprint(emotions_bp)
    app.register_blueprint(quiz_bp)
    app.register_blueprint(auth_bp)

    socketio.init_app(app)

    @app.route("/health", methods=["GET"])
    def health_check():
        """Lightweight health check."""
        return jsonify({"status": "ok"})

    return app


app = create_app()

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=True)

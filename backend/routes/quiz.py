"""Quiz generation endpoint based on emotion history."""
from collections import Counter
from flask import Blueprint, request, jsonify

from utils.db import fetch_emotions_for_student

quiz_bp = Blueprint("quiz", __name__)

QUESTION_BANK = {
    "Easy": [
        {
            "question": "What is 2 + 2?",
            "options": ["3", "4", "5", "6"],
            "answer": "4",
        },
        {
            "question": "Which planet is known as the Red Planet?",
            "options": ["Earth", "Mars", "Jupiter", "Venus"],
            "answer": "Mars",
        },
    ],
    "Medium": [
        {
            "question": "What does HTTP stand for?",
            "options": ["HyperText Transfer Protocol", "HighText Transfer Protocol", "Hyperlink Transfer Process", "Host Transfer Protocol"],
            "answer": "HyperText Transfer Protocol",
        },
        {
            "question": "Which data structure uses FIFO order?",
            "options": ["Stack", "Queue", "Tree", "Graph"],
            "answer": "Queue",
        },
    ],
    "Hard": [
        {
            "question": "What is the time complexity of binary search?",
            "options": ["O(n)", "O(log n)", "O(n log n)", "O(1)"],
            "answer": "O(log n)",
        },
        {
            "question": "Which layer type is commonly used for image feature extraction?",
            "options": ["Dense", "Convolutional", "Dropout", "Embedding"],
            "answer": "Convolutional",
        },
    ],
}

EMOTION_TO_DIFFICULTY = {
    "Confused": "Easy",
    "Engaged": "Hard",
    "Neutral": "Medium",
    "Bored": "Easy",
    "Distracted": "Easy",
}


@quiz_bp.route("/generate-quiz", methods=["GET"])
def generate_quiz():
    """Generate quiz questions based on recent emotions."""
    try:
        student_id_raw = request.args.get("student_id", "1")
        try:
            student_id = int(student_id_raw)
        except (TypeError, ValueError):
            return jsonify({"error": "student_id must be an integer"}), 400

        history = fetch_emotions_for_student(student_id, limit=50)

        if history:
            recent = [item["emotion"] for item in history[:10]]
            most_recent_emotion = Counter(recent).most_common(1)[0][0]
        else:
            most_recent_emotion = "Neutral"

        difficulty = EMOTION_TO_DIFFICULTY.get(most_recent_emotion, "Medium")
        questions = QUESTION_BANK[difficulty]

        return jsonify({
            "student_id": student_id,
            "emotion": most_recent_emotion,
            "difficulty": difficulty,
            "questions": questions,
        })
    except Exception as exc:  # pragma: no cover - defensive error handling
        return jsonify({"error": "Failed to generate quiz", "details": str(exc)}), 500

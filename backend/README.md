# Emotion Aware Virtual Classroom - Flask AI Backend

## Setup

1. Create a virtual environment and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Create the PostgreSQL database and schema:

```bash
psql -d postgres -c "CREATE DATABASE emotion_db;"
psql -d emotion_db -f ../database/schema.sql
```

3. Provide environment variables (example):

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=emotion_db
export DB_USER=<your_local_postgres_role>
export DB_PASSWORD=
export MODEL_PATH="../model/emotion_model.h5"
export PORT=5001
```

4. Run the server:

```bash
python app.py
```

## API Endpoints

- `POST /predict` (multipart form-data: `image`, optional `student_id`) or JSON with `image_base64`
- `GET /emotions?limit=200`
- `GET /generate-quiz?student_id=1`

## Notes

- Place your trained CNN model at `../model/emotion_model.h5` or set `MODEL_PATH`.
- Uses OpenCV Haar cascade for face detection before inference.
- Anti-fake logic:
	- No face -> returns `No Face`
	- Confidence threshold: `> 0.6`
	- Rolling majority vote over last 3 predictions
- Uses Socket.IO for real-time emotion updates (`emotion_update`).

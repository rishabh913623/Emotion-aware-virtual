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
- `POST /emotion-data` (JSON metadata only: `student_id`, `emotion`, `confidence`, `timestamp`, `room_id`)
- `GET /emotion-data/summary?room_id=<id>&window_size=10&distribution_limit=500`
- `GET /emotion-data/student/<student_id>?room_id=<id>&limit=30`
- `GET /emotions?limit=200`
- `GET /emotions/<room_id>?limit=300`
- `GET /generate-quiz?student_id=1`

## Notes

- Place your trained CNN model at `../model/emotion_model.h5` or set `MODEL_PATH`.
- Uses OpenCV Haar cascade for face detection before inference.
- Emotion metadata APIs do not store images/videos (privacy-safe).
- Uses Socket.IO for real-time emotion updates (`emotion_update`) for dashboard refresh.

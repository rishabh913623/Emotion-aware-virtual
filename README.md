# Emotion Aware Virtual Classroom

Production-oriented full-stack classroom app with video conferencing, emotion AI, chat, analytics, and quiz generation.

## Architecture

- `frontend/` -> React + Tailwind + WebRTC + Socket.IO client
- `signaling-server/` -> Node.js + Express + Socket.IO + PostgreSQL auth/rooms
- `backend/` -> Flask + TensorFlow + OpenCV emotion detection API
- `database/` -> PostgreSQL schema
- `model/` -> `emotion_model.h5`

## Quick Setup

1. Initialize PostgreSQL schema:

```bash
psql -d postgres -c "CREATE DATABASE emotion_db;"
psql -d emotion_db -f database/schema.sql
```

2. Start signaling backend:

```bash
cd signaling-server
npm install
cp .env.example .env
npm run dev
```

3. Start Flask AI backend (Python 3.11 recommended):

```bash
cd ../backend
python -m venv ../.venv
source ../.venv/bin/activate
pip install -r requirements.txt
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=emotion_db
export DB_USER=<your_local_postgres_role>
export DB_PASSWORD=
export MODEL_PATH="../model/emotion_model.h5"
export PORT=5001
python app.py
```

4. Start frontend:

```bash
cd ../frontend
npm install
cp .env.example .env
npm run dev
```

## Frontend Environment

```bash
VITE_SIGNALING_URL=http://localhost:4000
VITE_AI_API_URL=http://localhost:5001
```

## Core Capabilities

- Role-based auth (instructor/student)
- Room create/join and participant moderation
- WebRTC video/audio and screen share
- Real-time chat and participant state updates
- Emotion prediction every 15 seconds with anti-fake filtering
- Instructor dashboard with Chart.js visualizations
- Quiz generation from emotion history

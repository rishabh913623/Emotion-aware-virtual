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

## Production Deployment (Render + Vercel)

Deploy all components for full functionality:

- `signaling-server/` -> Render Web Service
- `backend/` -> Render Web Service
- `frontend/` -> Vercel Project
- PostgreSQL -> Render PostgreSQL

### Option A (recommended): Render Blueprint

This repo includes a ready blueprint at `render.yaml` that creates:

- one PostgreSQL database (`emotion-db`)
- signaling service (`emotion-signaling`)
- AI backend service (`emotion-ai-backend`)

In Render:

1. New + -> Blueprint
2. Select this repository
3. Confirm creation from `render.yaml`
4. After deploy, set `CORS_ORIGIN` on `emotion-signaling` to your Vercel URL

### Database Schema Migration

After the Render Postgres instance is up, run the schema once:

```bash
psql "<RENDER_POSTGRES_EXTERNAL_URL>" -f database/schema.sql
```

### Render Environment Variables

`emotion-signaling`:

- `NODE_ENV=production`
- `JWT_SECRET` (auto-generated in `render.yaml`, can be overridden)
- `CORS_ORIGIN=https://<your-vercel-domain>`
- `DATABASE_URL` (wired from Render Postgres)

`emotion-ai-backend`:

- `PYTHON_VERSION=3.11.9`
- `MODEL_PATH=../model/emotion_model.h5`
- `JWT_SECRET` (auto-generated in `render.yaml`, can be overridden)
- `TF_INTRA_THREADS=1`
- `TF_INTER_THREADS=1`
- `DATABASE_URL` (wired from Render Postgres)

### Vercel Setup

Create a Vercel project with root directory `frontend/`.

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`

Set these Vercel env vars:

```bash
VITE_SIGNALING_URL=https://<your-render-signaling-service>.onrender.com
VITE_AI_API_URL=https://<your-render-ai-backend-service>.onrender.com
```

`frontend/vercel.json` is included with SPA rewrite so routes like `/classroom` and `/dashboard` work on refresh.

### Post-deploy Verification

1. Open `https://<signaling>/health` -> should return `{ "status": "ok" }`
2. Open `https://<ai-backend>/health` -> should return `{ "status": "ok" }`
3. Open Vercel frontend URL
4. Register instructor + student
5. Create room as instructor and join as student
6. Confirm participant tiles, chat, and emotion updates are working

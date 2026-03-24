# Emotion Aware Virtual Classroom - Frontend

## Features

- Register/login with role-based access
- Classroom with WebRTC video grid
- Socket.IO chat and participant updates
- Emotion capture every 15 seconds for students
- Instructor dashboard with Chart.js visualizations

## Setup

```bash
npm install
cp .env.example .env
```

## Environment Variables

```bash
VITE_SIGNALING_URL=http://localhost:4000
VITE_AI_API_URL=http://localhost:5001
```

## Run

```bash
npm run dev
```

Open `http://localhost:5173`.

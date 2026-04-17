# Emotion Aware Virtual Classroom - Frontend

## Features

- Register/login with role-based access
- Classroom with WebRTC video grid
- Socket.IO chat and participant updates
- Real-time face emotion detection using pretrained `face-api.js`
- Per-video-tile face box overlay with emotion + confidence label
- Configurable detection interval (10-20 seconds)
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
VITE_API_BASE_URL=https://emotion-ai-backend-rwgf.onrender.com
VITE_EMOTION_DETECTION_INTERVAL_MS=15000
VITE_FACE_API_MODEL_URL=https://justadudewhohacks.github.io/face-api.js/models
```

## Emotion Integration Points

- `src/components/classroom/EmotionVideoTile.jsx`: WebRTC tile wrapper + overlay canvas
- `src/hooks/useEmotionDetection.js`: interval-based face detection and metadata POST
- `src/utils/faceApiModels.js`: shared model loader for TinyFaceDetector + FaceExpressionNet
- `src/pages/DashboardPage.jsx`: consumes real aggregated emotion metadata

## Run

```bash
npm run dev
```

Open `http://localhost:5173`.

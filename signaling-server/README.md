# Emotion Aware Virtual Classroom - Signaling Server

Node.js + Express + Socket.IO service for authentication, rooms, signaling, and chat.

## Features

- Register/login with JWT (`instructor` / `student` roles)
- Instructor room creation
- Room join/leave tracking
- WebRTC signaling (`offer`, `answer`, `ice-candidate`)
- Real-time chat
- Instructor moderation (mute/remove)

## Setup

```bash
npm install
cp .env.example .env
```

## Environment Variables

```bash
PORT=4000
JWT_SECRET=change_me
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://<role>@localhost:5432/emotion_db
```

## Run

```bash
npm run dev
```

## REST Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/rooms` (instructor)
- `GET /api/rooms/:roomId`

## Socket Events

- `room:join`, `room:participants`, `room:user-joined`, `room:user-left`
- `signal:offer`, `signal:answer`, `signal:ice-candidate`
- `chat:message`
- `room:update-state`, `room:moderation`

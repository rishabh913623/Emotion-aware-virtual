-- Database schema for Emotion Aware Virtual Classroom

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('instructor', 'student')),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rooms (
    id VARCHAR(64) PRIMARY KEY,
    instructor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emotions (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emotion VARCHAR(32) NOT NULL,
    confidence NUMERIC(5, 4) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emotion_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    room_id VARCHAR(128) NOT NULL,
    emotion VARCHAR(32) NOT NULL,
    confidence NUMERIC(5, 4) NOT NULL DEFAULT 0,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_rooms_instructor ON rooms (instructor_id);
CREATE INDEX IF NOT EXISTS idx_emotions_student_time
    ON emotions (student_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_emotions_timestamp ON emotions (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_emotion_logs_room_time ON emotion_logs (room_id, timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_emotion_logs_user_time ON emotion_logs (user_id, timestamp DESC);

-- Sample seed users (passwords must be hashed in real usage)
-- INSERT INTO users (name, role, email, password) VALUES
-- ('Demo Instructor', 'instructor', 'instructor@example.com', '$2b$10$...'),
-- ('Demo Student', 'student', 'student@example.com', '$2b$10$...');

-- Sample room creation
-- INSERT INTO rooms (id, instructor_id) VALUES ('room-1234', 1);

-- Sample emotion insert
-- INSERT INTO emotions (student_id, emotion, confidence) VALUES (2, 'Engaged', 0.9123);

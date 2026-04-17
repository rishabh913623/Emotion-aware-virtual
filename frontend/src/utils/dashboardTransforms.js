const EMOTION_SCORE_MAP = {
  happy: 5,
  engaged: 5,
  neutral: 3,
  surprised: 4,
  sad: 1,
  angry: 1,
  fearful: 1,
  fear: 1,
  disgusted: 1,
  confused: 2,
  distracted: 2,
  bored: 1
};

const EMOTION_ALIAS_MAP = {
  fear: "fearful",
  scared: "fearful",
  surprise: "surprised"
};

const normalizeEmotion = (emotion) => {
  const value = String(emotion || "").trim().toLowerCase();
  return EMOTION_ALIAS_MAP[value] || value;
};

const formatEmotionLabel = (emotion) => {
  const normalized = normalizeEmotion(emotion);
  if (!normalized) {
    return "Unknown";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const getEmotionScore = (emotion) => EMOTION_SCORE_MAP[normalizeEmotion(emotion)] ?? 2;

const normalizeRows = (rows = []) => {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => ({
      student_id: row?.student_id ?? row?.user_id ?? null,
      room_id: row?.room_id ?? null,
      emotion: normalizeEmotion(row?.emotion),
      confidence: Number(row?.confidence ?? 0),
      timestamp: row?.timestamp ?? row?.time ?? null
    }))
    .filter((row) => Boolean(row.timestamp) && Boolean(row.emotion));
};

const sortByTimestampAsc = (rows = []) => {
  return [...rows].sort((left, right) => new Date(left.timestamp || 0) - new Date(right.timestamp || 0));
};

export const getEmotionDistribution = (rows = []) => {
  const normalizedRows = normalizeRows(rows);
  const base = {
    Happy: 0,
    Neutral: 0,
    Sad: 0,
    Angry: 0,
    Surprised: 0,
    Fear: 0,
    Fearful: 0,
    Disgusted: 0
  };

  normalizedRows.forEach((row) => {
    const label = formatEmotionLabel(row.emotion);
    if (label === "Fear") {
      base.Fear += 1;
      base.Fearful += 1;
      return;
    }
    if (label === "Fearful") {
      base.Fear += 1;
      base.Fearful += 1;
      return;
    }
    if (base[label] !== undefined) {
      base[label] += 1;
    }
  });

  return base;
};

export const getTrendData = (rows = [], bucketMs = 60_000) => {
  const normalizedRows = normalizeRows(rows);
  const grouped = new Map();

  sortByTimestampAsc(normalizedRows).forEach((row) => {
    const timestamp = new Date(row.timestamp || 0);
    if (Number.isNaN(timestamp.getTime())) {
      return;
    }

    const bucketTime = new Date(Math.floor(timestamp.getTime() / bucketMs) * bucketMs).toISOString();
    if (!grouped.has(bucketTime)) {
      grouped.set(bucketTime, []);
    }
    grouped.get(bucketTime).push(row);
  });

  return Array.from(grouped.entries()).map(([timestamp, entries]) => {
    const emotionCounts = {};
    entries.forEach((entry) => {
      const emotion = formatEmotionLabel(entry.emotion);
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    });

    const dominantEmotion = Object.entries(emotionCounts).sort((left, right) => right[1] - left[1])[0]?.[0] || "Neutral";

    return {
      timestamp,
      time: timestamp,
      emotion: dominantEmotion
    };
  });
};

export const getStudentStats = (rows = [], windowSize = 10) => {
  const normalizedRows = normalizeRows(rows);
  const byStudent = new Map();

  sortByTimestampAsc(normalizedRows).forEach((row) => {
    const studentId = String(row.student_id || row.user_id || "");
    if (!studentId) {
      return;
    }

    if (!byStudent.has(studentId)) {
      byStudent.set(studentId, []);
    }
    byStudent.get(studentId).push(row);
  });

  return Array.from(byStudent.entries()).map(([studentId, studentRows]) => {
    const sample = studentRows.slice(-windowSize);
    const dominantCounter = {};

    let confidenceTotal = 0;
    let scoreTotal = 0;

    sample.forEach((entry) => {
      const normalized = normalizeEmotion(entry.emotion);
      const label = formatEmotionLabel(normalized);
      dominantCounter[label] = (dominantCounter[label] || 0) + 1;
      confidenceTotal += Number(entry.confidence || 0);
      scoreTotal += getEmotionScore(normalized);
    });

    const dominantEmotion = Object.entries(dominantCounter).sort((left, right) => right[1] - left[1])[0]?.[0] || "Unknown";

    return {
      student_id: studentId,
      dominant_emotion: dominantEmotion,
      average_confidence: sample.length ? confidenceTotal / sample.length : 0,
      rolling_average_score: sample.length ? scoreTotal / sample.length : 0,
      samples: sample.length
    };
  }).sort((left, right) => right.rolling_average_score - left.rolling_average_score);
};

export const getAverageScore = (rows = []) => {
  const normalizedRows = normalizeRows(rows);
  if (!normalizedRows.length) {
    return 0;
  }

  const total = normalizedRows.reduce((sum, row) => sum + getEmotionScore(row.emotion), 0);
  return total / normalizedRows.length;
};

export const getEngagementLevel = (distribution = {}) => {
  const happy = distribution.Happy || 0;
  const neutral = distribution.Neutral || 0;
  const lowSignals = (distribution.Sad || 0) + (distribution.Angry || 0) + (distribution.Fearful || 0);

  if (happy >= neutral && happy >= lowSignals) {
    return "High";
  }
  if (neutral >= happy && neutral >= lowSignals) {
    return "Medium";
  }
  return "Low";
};

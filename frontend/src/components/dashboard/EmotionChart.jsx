import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

const EMOTION_SCORE_MAP = {
  Engaged: 5,
  Happy: 5,
  happy: 5,
  Surprised: 4,
  surprised: 4,
  Neutral: 3,
  neutral: 3,
  Angry: 1,
  angry: 1,
  Fearful: 1,
  fearful: 1,
  Disgusted: 1,
  disgusted: 1,
  Confused: 2,
  confused: 2,
  Distracted: 2,
  distracted: 2,
  Bored: 1,
  bored: 1,
  Sad: 1,
  sad: 1,
  "No Face": 0,
  Unavailable: 0,
  Uncertain: 0
};

const EmotionChart = ({ counts, timeline = [], roomId = "" }) => {
  const labels = ["Happy", "Neutral", "Sad", "Angry", "Fearful", "Disgusted", "Surprised"];
  const normalizedTimeline = [...timeline].sort(
    (left, right) => new Date(left.timestamp || left.time || 0) - new Date(right.timestamp || right.time || 0)
  );

  console.log("[dashboard] chart input", {
    roomId,
    counts,
    timelinePoints: normalizedTimeline.length
  });

  const data = {
    labels,
    datasets: [
      {
        label: "Emotion Distribution",
        data: labels.map((label) => counts[label] || 0),
        backgroundColor: ["#2563eb", "#22c55e", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#f97316"]
      }
    ]
  };

  const timelineData = {
    labels: normalizedTimeline.map((entry) => new Date(entry.timestamp || entry.time).toLocaleTimeString()),
    datasets: [
      {
        label: roomId ? `Room ${roomId} Emotion Trend` : "Room Emotion Trend",
        data: normalizedTimeline.map((entry) => EMOTION_SCORE_MAP[entry.emotion] ?? 2),
        borderColor: "#4f46e5",
        backgroundColor: "rgba(79, 70, 229, 0.2)",
        tension: 0.25,
        fill: true
      }
    ]
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Emotion Distribution</h3>
      <Bar data={data} options={{ responsive: true, plugins: { legend: { display: false } } }} />

      <h3 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Emotion Trend Over Time</h3>
      <Line
        data={timelineData}
        options={{
          responsive: true,
          scales: {
            y: {
              min: 0,
              max: 5,
              ticks: {
                stepSize: 1
              }
            }
          }
        }}
      />
    </div>
  );
};

export default EmotionChart;

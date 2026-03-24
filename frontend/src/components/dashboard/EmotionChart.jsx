import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const EmotionChart = ({ counts }) => {
  const labels = ["Engaged", "Confused", "Bored", "Distracted", "Neutral"];

  const data = {
    labels,
    datasets: [
      {
        label: "Emotion Distribution",
        data: labels.map((label) => counts[label] || 0),
        backgroundColor: ["#2563eb", "#f59e0b", "#ef4444", "#8b5cf6", "#10b981"]
      }
    ]
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Emotion Distribution</h3>
      <Bar data={data} options={{ responsive: true, plugins: { legend: { display: false } } }} />
    </div>
  );
};

export default EmotionChart;

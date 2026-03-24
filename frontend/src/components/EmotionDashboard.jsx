import React, { useEffect, useState } from "react";
import apiClient from "../api/client.js";
import socket from "../api/socket.js";

const REFRESH_INTERVAL_MS = 10000;
const EMOTIONS = ["Engaged", "Confused", "Bored", "Distracted", "Neutral"];

const EmotionDashboard = () => {
  const [counts, setCounts] = useState({});
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState("Loading dashboard...");
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get("/emotions");
      const data = response.data || {};
      setCounts(data.counts || {});
      setHistory(data.history || []);
      setStatus("Last updated: " + new Date().toLocaleTimeString());
    } catch (error) {
      setStatus("Failed to load dashboard data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const intervalId = setInterval(fetchDashboard, REFRESH_INTERVAL_MS);

    socket.on("emotion_update", (payload) => {
      if (!payload) {
        return;
      }

      setCounts((prev) => ({
        ...prev,
        [payload.emotion]: (prev[payload.emotion] || 0) + 1
      }));

      setHistory((prev) => [
        {
          id: `live-${Date.now()}`,
          student_id: payload.student_id,
          emotion: payload.emotion,
          timestamp: payload.timestamp || new Date().toISOString()
        },
        ...prev
      ].slice(0, 20));
    });

    return () => {
      clearInterval(intervalId);
      socket.off("emotion_update");
    };
  }, []);

  const maxCount = Math.max(1, ...EMOTIONS.map((emotion) => counts[emotion] || 0));

  return (
    <section className="rounded-2xl bg-white p-6 shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Instructor Dashboard</h2>
          <p className="text-xs text-slate-500">{status}</p>
        </div>
        {isLoading && <span className="text-xs text-blue-600">Loading...</span>}
      </div>

      <div className="mt-6 space-y-3">
        {EMOTIONS.map((emotion) => (
          <div key={emotion} className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium text-slate-700">
              <span>{emotion}</span>
              <span>{counts[emotion] || 0}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400"
                style={{ width: `${((counts[emotion] || 0) / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-900">Recent Emotions</h3>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No records yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-xs text-slate-600">
            {history.slice(0, 10).map((item) => (
              <li
                key={`${item.id}-${item.timestamp}`}
                className="grid grid-cols-3 gap-2"
              >
                <span>#{item.student_id}</span>
                <span>{item.emotion}</span>
                <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default EmotionDashboard;

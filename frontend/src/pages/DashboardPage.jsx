import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { aiClient } from "../api/client";
import { createAiSocket } from "../api/socket";
import { useAuth } from "../context/AuthContext";
import EmotionChart from "../components/dashboard/EmotionChart";
import StudentEmotionTable from "../components/dashboard/StudentEmotionTable";

const DashboardPage = () => {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const currentUser = auth?.user;
  const [counts, setCounts] = useState({});
  const [history, setHistory] = useState([]);
  const [studentWise, setStudentWise] = useState([]);
  const [error, setError] = useState("");

  const aiSocket = useMemo(() => createAiSocket(), []);

  const fetchData = async () => {
    try {
      const response = await aiClient.get("/emotions?limit=300");
      setCounts(response.data.counts || {});
      setHistory(response.data.history || []);
      setStudentWise(response.data.student_wise || []);
      setError("");
    } catch (apiError) {
      setError("Failed to fetch dashboard data");
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);

    aiSocket.on("emotion_update", (payload) => {
      setCounts((prev) => ({
        ...prev,
        [payload.emotion]: (prev[payload.emotion] || 0) + 1
      }));
      setHistory((prev) => [
        {
          id: payload.timestamp,
          student_id: payload.student_id,
          emotion: payload.emotion,
          confidence: payload.confidence,
          timestamp: payload.timestamp
        },
        ...prev
      ].slice(0, 50));
    });

    return () => {
      clearInterval(interval);
      aiSocket.off("emotion_update");
      aiSocket.disconnect();
    };
  }, [aiSocket]);

  if (!currentUser || currentUser.role !== "instructor") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-600">Dashboard is instructor-only.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <header className="mx-auto mb-4 flex max-w-6xl items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Instructor Dashboard</h1>
          <p className="text-sm text-slate-500">Real-time emotion analytics and trends</p>
        </div>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white" onClick={() => navigate("/classroom")}>
          Back to Classroom
        </button>
      </header>

      {error && <p className="mx-auto mb-4 max-w-6xl text-sm text-rose-600">{error}</p>}

      <main className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-2">
        <EmotionChart counts={counts} />
        <StudentEmotionTable rows={studentWise} />

        <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Recent Emotions</h3>
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="pb-2">Student</th>
                  <th className="pb-2">Emotion</th>
                  <th className="pb-2">Confidence</th>
                  <th className="pb-2">Time</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {history.slice(0, 30).map((item, index) => (
                  <tr key={`${item.id}-${index}`}>
                    <td className="py-1">{item.student_id}</td>
                    <td className="py-1">{item.emotion}</td>
                    <td className="py-1">{Number(item.confidence || 0).toFixed(2)}</td>
                    <td className="py-1">{new Date(item.timestamp).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;

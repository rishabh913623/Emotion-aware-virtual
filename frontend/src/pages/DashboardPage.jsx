import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { aiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";
import EmotionChart from "../components/dashboard/EmotionChart";
import StudentEmotionTable from "../components/dashboard/StudentEmotionTable";
import {
  getEmotionDistribution,
  getStudentStats,
  getTrendData,
  getAverageScore,
  getEngagementLevel,
} from "../utils/dashboardTransforms";

const DashboardPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { auth } = useAuth();
  const currentUser = auth?.user;
  const [counts, setCounts] = useState({});
  const [history, setHistory] = useState([]);
  const [studentWise, setStudentWise] = useState([]);
  const [roomId, setRoomId] = useState(() => location.state?.roomId || localStorage.getItem("last_room_id") || "");
  const [roomHistory, setRoomHistory] = useState([]);
  const [error, setError] = useState("");

  const timelineSource = roomHistory.length ? roomHistory : history;
  const averageEmotionScore = useMemo(() => {
    return getAverageScore(history);
  }, [history]);

  const engagementLevel = useMemo(() => {
    return getEngagementLevel(counts);
  }, [counts]);

  const normalizeEmotionRows = (payload) => {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload?.history)) {
      return payload.history;
    }

    if (Array.isArray(payload?.data)) {
      return payload.data;
    }

    return [];
  };

  const fetchData = async () => {
    try {
      const response = await aiClient.get("/emotion-data", {
        params: {
          limit: 500,
          ...(roomId ? { room_id: roomId } : {})
        }
      });
      const rows = normalizeEmotionRows(response.data);
      const normalizedRows = [...rows].sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));

      setHistory(normalizedRows);
      setCounts(getEmotionDistribution(normalizedRows));
      setRoomHistory(getTrendData(normalizedRows));
      setStudentWise(getStudentStats(normalizedRows));
      setError("");
    } catch (apiError) {
      setError("Failed to fetch dashboard data");
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);

    return () => {
      clearInterval(interval);
    };
  }, [roomId]);

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
        <button
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white"
          onClick={() => navigate("/classroom", { state: { roomId } })}
        >
          Back to Classroom
        </button>
      </header>

      {error && <p className="mx-auto mb-4 max-w-6xl text-sm text-rose-600">{error}</p>}

      <main className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Average Emotion Score</h3>
          <p className="mt-2 text-2xl font-bold text-indigo-600">{averageEmotionScore.toFixed(2)} / 5</p>
          <p className="mt-1 text-xs text-slate-500">Computed from room timeline emotion samples.</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Engagement Indicator</h3>
          <span
            className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
              engagementLevel === "High"
                ? "bg-emerald-100 text-emerald-700"
                : engagementLevel === "Medium"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-rose-100 text-rose-700"
            }`}
          >
            {engagementLevel}
          </span>
          <p className="mt-2 text-xs text-slate-500">High: attentive class, Medium: mixed focus, Low: needs intervention.</p>
          {(counts.Sad || 0) + (counts.Neutral || 0) > Object.values(counts).reduce((sum, value) => sum + value, 0) / 2 && (
            <p className="mt-2 text-xs font-semibold text-rose-600">Alert: majority emotions are sad/neutral.</p>
          )}
        </div>

        <EmotionChart counts={counts} timeline={timelineSource} roomId={roomId} />
        <StudentEmotionTable rows={studentWise} />

        <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Room Filter</h3>
          <div className="flex max-w-md gap-2">
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              placeholder="Enter room ID"
            />
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white" onClick={fetchData}>
              Load
            </button>
          </div>
        </div>

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

import React from "react";

const StudentEmotionTable = ({ rows }) => {
  const hasRolling = rows.some((row) => row.rolling_average_score !== undefined);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Student-wise Emotions</h3>
      <div className="max-h-64 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-500">
            <tr>
              <th className="pb-2">Student ID</th>
              <th className="pb-2">Dominant Emotion</th>
              <th className="pb-2">Avg Confidence</th>
              <th className="pb-2">Rolling Score</th>
              {!hasRolling && <th className="pb-2">Count</th>}
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {rows.map((row, index) => (
              <tr key={`${row.student_id}-${row.emotion}-${index}`}>
                <td className="py-1">{row.student_id}</td>
                <td className="py-1">{row.dominant_emotion || row.emotion || "Unknown"}</td>
                <td className="py-1">{Number(row.average_confidence ?? 0).toFixed(2)}</td>
                <td className="py-1">{Number(row.rolling_average_score ?? 0).toFixed(2)}</td>
                {!hasRolling && <td className="py-1">{row.count}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StudentEmotionTable;

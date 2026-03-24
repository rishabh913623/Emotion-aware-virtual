import React from "react";

const EmotionHistory = ({ history }) => {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-lg">
      <h2 className="text-lg font-semibold text-slate-900">Emotion History</h2>
      {history.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No emotions yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {history.map((item, index) => (
            <li
              key={`${item.emotion}-${index}`}
              className="flex items-center justify-between text-sm text-slate-600"
            >
              <span className="font-medium text-slate-700">{item.emotion}</span>
              <span>{item.timestamp}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default EmotionHistory;

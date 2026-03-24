import React from "react";

const EmotionDisplay = ({ emotion }) => {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-lg">
      <h2 className="text-lg font-semibold text-slate-900">Current Emotion</h2>
      <div className="mt-4 text-3xl font-semibold text-blue-600">{emotion}</div>
    </div>
  );
};

export default EmotionDisplay;

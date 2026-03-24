import React from "react";

const EmotionSidebar = ({ currentEmotion, history, error, quiz, onGenerateQuiz }) => {
  return (
    <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Emotion Status</h3>
        <p className="mt-2 text-lg font-semibold text-indigo-600">{currentEmotion}</p>
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </div>

      <div>
        <h4 className="text-xs font-semibold text-slate-700">Recent Predictions</h4>
        <ul className="mt-2 space-y-1 text-xs text-slate-600">
          {history.slice(0, 6).map((item, index) => (
            <li key={`${item.timestamp}-${index}`} className="flex justify-between">
              <span>{item.emotion}</span>
              <span>{item.timestamp}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <button
          className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white"
          onClick={onGenerateQuiz}
        >
          Generate Quiz
        </button>
        {quiz?.questions?.length > 0 && (
          <div className="mt-2 space-y-2 text-xs text-slate-700">
            {quiz.questions.slice(0, 2).map((question, index) => (
              <div key={index} className="rounded-md bg-slate-100 p-2">
                <p className="font-medium">{question.question}</p>
                <p className="mt-1 text-slate-500">Options: {question.options.join(", ")}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};

export default EmotionSidebar;

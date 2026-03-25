import React, { useMemo } from "react";

const QuizPanel = ({
  role,
  uploadFile,
  onFileChange,
  onGenerateQuiz,
  onPublishQuiz,
  questions,
  selectedAnswers,
  onSelectAnswer,
  submitted,
  onSubmitQuiz,
  score,
  status
}) => {
  const isInstructor = role === "instructor";

  const totalQuestions = questions?.length || 0;
  const answeredCount = useMemo(
    () => Object.keys(selectedAnswers || {}).length,
    [selectedAnswers]
  );

  return (
    <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Learning Quiz</h3>
        {status && <span className="text-xs text-slate-500">{status}</span>}
      </div>

      {isInstructor ? (
        <div className="space-y-3">
          <input
            type="file"
            accept=".pdf,.ppt,.pptx"
            onChange={onFileChange}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white"
              onClick={onGenerateQuiz}
              disabled={!uploadFile}
            >
              Generate from File
            </button>
            <button
              type="button"
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white"
              onClick={onPublishQuiz}
              disabled={!totalQuestions}
            >
              Send to Students
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Quiz appears here when instructor publishes it.</p>
      )}

      {totalQuestions > 0 && (
        <div className="max-h-80 space-y-3 overflow-auto">
          {questions.map((question, index) => (
            <div key={`${question.question}-${index}`} className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-800">
                Q{index + 1}. {question.question}
              </p>
              <div className="mt-2 grid gap-2">
                {(question.options || []).map((option) => {
                  const isSelected = selectedAnswers?.[index] === option;
                  const isCorrect = submitted && option === question.answer;
                  const isWrongSelected = submitted && isSelected && !isCorrect;
                  const buttonClass = isCorrect
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : isWrongSelected
                      ? "border-rose-500 bg-rose-50 text-rose-700"
                      : isSelected
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-white text-slate-700";

                  return (
                    <button
                      key={`${index}-${option}`}
                      type="button"
                      disabled={submitted}
                      className={`rounded-md border px-2 py-1 text-left text-xs ${buttonClass}`}
                      onClick={() => onSelectAnswer(index, option)}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isInstructor && totalQuestions > 0 && !submitted && (
        <button
          type="button"
          className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
          onClick={onSubmitQuiz}
          disabled={answeredCount !== totalQuestions}
        >
          Submit Quiz ({answeredCount}/{totalQuestions})
        </button>
      )}

      {!isInstructor && submitted && (
        <div className="rounded-lg bg-indigo-50 p-2 text-xs font-semibold text-indigo-700">
          Score: {score}/{totalQuestions}
        </div>
      )}
    </aside>
  );
};

export default QuizPanel;

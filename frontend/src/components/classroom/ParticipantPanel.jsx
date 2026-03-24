import React from "react";

const ParticipantPanel = ({ participants, canModerate, onMute, onRemove }) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Participants</h3>
      <ul className="mt-3 space-y-2 text-xs text-slate-700">
        {participants.map((participant) => (
          <li key={participant.socketId} className="flex items-center justify-between rounded-md bg-slate-100 p-2">
            <div>
              <p className="font-semibold">{participant.name}</p>
              <p className="text-slate-500">{participant.role}</p>
            </div>
            {canModerate && participant.role === "student" && (
              <div className="flex gap-1">
                <button
                  className="rounded bg-amber-500 px-2 py-1 text-white"
                  onClick={() => onMute(participant.socketId)}
                >
                  Mute
                </button>
                <button
                  className="rounded bg-rose-600 px-2 py-1 text-white"
                  onClick={() => onRemove(participant.socketId)}
                >
                  Remove
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ParticipantPanel;

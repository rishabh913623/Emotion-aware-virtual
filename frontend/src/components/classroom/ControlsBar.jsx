import React from "react";

const ControlsBar = ({
  audioEnabled,
  videoEnabled,
  sharing,
  detectionIntervalMs,
  onDetectionIntervalChange,
  onToggleAudio,
  onToggleVideo,
  onShare,
  onLeave
}) => {
  return (
    <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
      <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white" onClick={onToggleAudio}>
        {audioEnabled ? "Mute Mic" : "Unmute Mic"}
      </button>
      <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white" onClick={onToggleVideo}>
        {videoEnabled ? "Turn Camera Off" : "Turn Camera On"}
      </button>
      <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white" onClick={onShare}>
        {sharing ? "Sharing Screen" : "Share Screen"}
      </button>
      <select
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        value={detectionIntervalMs}
        onChange={(event) => onDetectionIntervalChange(Number(event.target.value))}
      >
        <option value={3000}>Detection: 3s</option>
        <option value={10000}>Detection: 10s</option>
        <option value={20000}>Detection: 20s</option>
      </select>
      <button className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white" onClick={onLeave}>
        Leave Room
      </button>
    </div>
  );
};

export default ControlsBar;

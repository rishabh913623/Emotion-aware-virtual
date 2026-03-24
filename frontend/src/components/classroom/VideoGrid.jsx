import React from "react";

const RemoteVideo = ({ stream, label }) => {
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="rounded-xl bg-slate-900 p-2">
      <video ref={ref} autoPlay playsInline className="h-40 w-full rounded-lg object-cover" />
      <p className="mt-2 text-xs text-slate-300">{label}</p>
    </div>
  );
};

const VideoGrid = ({ localVideoRef, remoteStreams, participants, selfName }) => {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      <div className="rounded-xl bg-blue-950 p-2">
        <video ref={localVideoRef} autoPlay muted playsInline className="h-40 w-full rounded-lg object-cover" />
        <p className="mt-2 text-xs text-blue-100">{selfName} (You)</p>
      </div>

      {Object.entries(remoteStreams).map(([socketId, stream]) => {
        const participant = participants.find((item) => item.socketId === socketId);
        return (
          <RemoteVideo
            key={socketId}
            stream={stream}
            label={participant?.name || `Participant ${socketId.slice(0, 4)}`}
          />
        );
      })}
    </div>
  );
};

export default VideoGrid;

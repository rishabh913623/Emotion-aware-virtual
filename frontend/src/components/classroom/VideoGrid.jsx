import React from "react";

const RemoteVideo = ({ stream, label }) => {
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <div className="rounded-xl bg-slate-900 p-2">
      {stream ? (
        <video ref={ref} autoPlay playsInline className="h-40 w-full rounded-lg object-cover" />
      ) : (
        <div className="flex h-40 w-full items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-300">
          Connecting video...
        </div>
      )}
      <p className="mt-2 text-xs text-slate-300">{label}</p>
    </div>
  );
};

const VideoGrid = ({ localVideoRef, remoteStreams, participants, selfName, selfSocketId }) => {
  const participantMap = new Map(
    participants
      .filter((participant) => participant.socketId !== selfSocketId)
      .map((participant) => [participant.socketId, participant])
  );

  Object.keys(remoteStreams).forEach((socketId) => {
    if (socketId !== selfSocketId && !participantMap.has(socketId)) {
      participantMap.set(socketId, { socketId, name: `Participant ${socketId.slice(0, 4)}` });
    }
  });

  const remoteParticipants = Array.from(participantMap.values());

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      <div className="rounded-xl bg-blue-950 p-2">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="h-40 w-full rounded-lg object-cover"
          onLoadedMetadata={(event) => event.currentTarget.play().catch(() => {})}
        />
        <p className="mt-2 text-xs text-blue-100">{selfName} (You)</p>
      </div>

      {remoteParticipants.map((participant) => {
        const stream = remoteStreams[participant.socketId];
        return (
          <RemoteVideo
            key={participant.socketId}
            stream={stream}
            label={participant?.name || `Participant ${participant.socketId.slice(0, 4)}`}
          />
        );
      })}
    </div>
  );
};

export default VideoGrid;

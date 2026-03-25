import React from "react";

const RemoteVideo = ({ stream, label, videoClassName = "h-40 w-full rounded-lg object-cover", containerClassName = "rounded-xl bg-slate-900 p-2" }) => {
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <div className={containerClassName}>
      {stream ? (
        <video ref={ref} autoPlay playsInline className={videoClassName} />
      ) : (
        <div className="flex h-40 w-full items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-300">
          Connecting video...
        </div>
      )}
      <p className="mt-2 text-xs text-slate-300">{label}</p>
    </div>
  );
};

const LocalVideo = ({ localVideoRef, selfName }) => {
  return (
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
  );
};

const VideoGrid = ({ localVideoRef, remoteStreams, participants, selfName, selfSocketId, screenSharer }) => {
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

  const isScreenSharing = Boolean(screenSharer?.socketId);
  const screenSharerSocketId = screenSharer?.socketId;
  const mainIsSelf = screenSharerSocketId && screenSharerSocketId === selfSocketId;
  const mainStream = mainIsSelf ? null : remoteStreams[screenSharerSocketId];

  if (isScreenSharing) {
    const sidebarParticipants = [
      { socketId: selfSocketId, name: `${selfName} (You)`, isSelf: true },
      ...remoteParticipants
    ].filter((participant) => participant.socketId !== screenSharerSocketId);

    return (
      <div className="flex flex-col gap-3 xl:flex-row">
        <div className="w-full xl:w-3/4">
          <div className="rounded-xl bg-slate-900 p-2">
            {mainIsSelf ? (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="h-[26rem] w-full rounded-lg object-contain bg-black"
                onLoadedMetadata={(event) => event.currentTarget.play().catch(() => {})}
              />
            ) : mainStream ? (
              <RemoteVideo
                stream={mainStream}
                label={screenSharer?.name || `Participant ${screenSharerSocketId?.slice(0, 4)}`}
                videoClassName="h-[26rem] w-full rounded-lg object-contain bg-black"
              />
            ) : (
              <div className="flex h-[26rem] w-full items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-300">
                Waiting for shared screen...
              </div>
            )}
            <p className="mt-2 text-xs text-slate-300">
              {screenSharer?.name || "Instructor"} is sharing screen
            </p>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-3 xl:w-1/4 xl:grid-cols-1">
          {sidebarParticipants.map((participant) => {
            if (participant.isSelf) {
              return <LocalVideo key="self-tile" localVideoRef={localVideoRef} selfName={selfName} />;
            }

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
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      <LocalVideo localVideoRef={localVideoRef} selfName={selfName} />

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

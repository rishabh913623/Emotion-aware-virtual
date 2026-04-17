import React from "react";
import EmotionVideoTile from "./EmotionVideoTile";

const VideoGrid = ({
  localVideoRef,
  remoteStreams,
  participants,
  selfName,
  selfSocketId,
  selfStudentId,
  roomId,
  screenSharer,
  enableEmotionDetection,
  onSelfEmotionDetected,
  onDetectionError,
}) => {
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
              <EmotionVideoTile
                videoRef={localVideoRef}
                label={screenSharer?.name || `${selfName} (You)`}
                studentId={selfStudentId}
                roomId={roomId}
                muted
                enableDetection={enableEmotionDetection}
                onDetection={onSelfEmotionDetected}
                onError={onDetectionError}
                videoClassName="h-[26rem] w-full rounded-lg object-contain bg-black"
                containerClassName="rounded-xl bg-slate-900 p-0"
              />
            ) : mainStream ? (
              <EmotionVideoTile
                stream={mainStream}
                label={screenSharer?.name || `Participant ${screenSharerSocketId?.slice(0, 4)}`}
                studentId={screenSharer?.userId || screenSharerSocketId}
                roomId={roomId}
                enableDetection={enableEmotionDetection}
                onError={onDetectionError}
                videoClassName="h-[26rem] w-full rounded-lg object-contain bg-black"
                containerClassName="rounded-xl bg-slate-900 p-0"
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
              return (
                <EmotionVideoTile
                  key="self-tile"
                  videoRef={localVideoRef}
                  label={`${selfName} (You)`}
                  studentId={selfStudentId}
                  roomId={roomId}
                  muted
                  enableDetection={enableEmotionDetection}
                  onDetection={onSelfEmotionDetected}
                  onError={onDetectionError}
                  containerClassName="rounded-xl bg-blue-950 p-2"
                />
              );
            }

            const stream = remoteStreams[participant.socketId];
            return (
              <EmotionVideoTile
                key={participant.socketId}
                stream={stream}
                label={participant?.name || `Participant ${participant.socketId.slice(0, 4)}`}
                studentId={participant?.userId || participant.socketId}
                roomId={roomId}
                enableDetection={enableEmotionDetection}
                onError={onDetectionError}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      <EmotionVideoTile
        videoRef={localVideoRef}
        label={`${selfName} (You)`}
        studentId={selfStudentId}
        roomId={roomId}
        muted
        enableDetection={enableEmotionDetection}
        onDetection={onSelfEmotionDetected}
        onError={onDetectionError}
        containerClassName="rounded-xl bg-blue-950 p-2"
      />

      {remoteParticipants.map((participant) => {
        const stream = remoteStreams[participant.socketId];
        return (
          <EmotionVideoTile
            key={participant.socketId}
            stream={stream}
            label={participant?.name || `Participant ${participant.socketId.slice(0, 4)}`}
            studentId={participant?.userId || participant.socketId}
            roomId={roomId}
            enableDetection={enableEmotionDetection}
            onError={onDetectionError}
          />
        );
      })}
    </div>
  );
};

export default VideoGrid;

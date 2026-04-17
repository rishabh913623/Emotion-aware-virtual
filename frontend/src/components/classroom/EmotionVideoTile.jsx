import React from "react";
import { useEmotionDetection } from "../../hooks/useEmotionDetection";

const EmotionVideoTile = ({
  stream,
  label,
  studentId,
  roomId,
  videoRef,
  muted = false,
  enableDetection = true,
  onDetection,
  onError,
  videoClassName = "h-40 w-full rounded-lg object-cover",
  containerClassName = "rounded-xl bg-slate-900 p-2"
}) => {
  const internalVideoRef = React.useRef(null);
  const targetVideoRef = videoRef || internalVideoRef;

  React.useEffect(() => {
    if (!stream || videoRef) {
      return;
    }
    // Remote WebRTC streams bind directly to the tile video element.
    if (targetVideoRef.current) {
      targetVideoRef.current.srcObject = stream;
      targetVideoRef.current.play().catch(() => {});
    }
  }, [stream, videoRef, targetVideoRef]);

  const { overlayRef } = useEmotionDetection({
    enabled: enableDetection,
    videoRef: targetVideoRef,
    studentId,
    roomId,
    onDetection,
    onError
  });

  return (
    <div className={containerClassName}>
      {stream || videoRef ? (
        <div className="relative">
          <video
            ref={targetVideoRef}
            autoPlay
            muted={muted}
            playsInline
            className={videoClassName}
            onLoadedMetadata={(event) => event.currentTarget.play().catch(() => {})}
          />
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        </div>
      ) : (
        <div className="flex h-40 w-full items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-300">
          Connecting video...
        </div>
      )}
      <p className="mt-2 text-xs text-slate-300">{label}</p>
    </div>
  );
};

export default EmotionVideoTile;

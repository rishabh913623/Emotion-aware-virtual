import { useCallback, useEffect, useRef, useState } from "react";

const RTC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

export const useWebRTC = ({ socket, roomId, enabled }) => {
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const [participants, setParticipants] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState({});

  const updateRemoteStream = (socketId, stream) => {
    setRemoteStreams((prev) => ({ ...prev, [socketId]: stream }));
  };

  const removeRemoteStream = (socketId) => {
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
  };

  const ensurePeerConnection = useCallback(
    (targetSocketId) => {
      if (peerConnectionsRef.current.has(targetSocketId)) {
        return peerConnectionsRef.current.get(targetSocketId);
      }

      const connection = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionsRef.current.set(targetSocketId, connection);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          connection.addTrack(track, localStreamRef.current);
        });
      }

      connection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("signal:ice-candidate", {
            targetSocketId,
            candidate: event.candidate
          });
        }
      };

      connection.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream) {
          updateRemoteStream(targetSocketId, stream);
        }
      };

      connection.onconnectionstatechange = () => {
        if (["closed", "failed", "disconnected"].includes(connection.connectionState)) {
          connection.close();
          peerConnectionsRef.current.delete(targetSocketId);
          removeRemoteStream(targetSocketId);
        }
      };

      return connection;
    },
    [socket]
  );

  const createOffer = useCallback(
    async (targetSocketId) => {
      const connection = ensurePeerConnection(targetSocketId);
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      socket.emit("signal:offer", {
        targetSocketId,
        sdp: offer
      });
    },
    [ensurePeerConnection, socket]
  );

  const initializeLocalMedia = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    return stream;
  }, []);

  useEffect(() => {
    if (!socket || !roomId || !enabled) {
      return undefined;
    }

    let mounted = true;

    const bootstrap = async () => {
      try {
        await initializeLocalMedia();
        socket.emit("room:join", { roomId });
      } catch (error) {
        console.error("Failed to initialize media", error);
      }
    };

    bootstrap();

    socket.on("room:participants", (list) => {
      if (!mounted) {
        return;
      }
      setParticipants(list);
      list.forEach((participant) => {
        if (participant.socketId !== socket.id) {
          createOffer(participant.socketId);
        }
      });
    });

    socket.on("room:user-joined", (participant) => {
      setParticipants((prev) => {
        const exists = prev.some((item) => item.socketId === participant.socketId);
        if (exists) {
          return prev;
        }
        return [...prev, participant];
      });
      if (participant.socketId !== socket.id) {
        createOffer(participant.socketId);
      }
    });

    socket.on("room:user-left", ({ socketId }) => {
      setParticipants((prev) => prev.filter((item) => item.socketId !== socketId));
      const connection = peerConnectionsRef.current.get(socketId);
      if (connection) {
        connection.close();
      }
      peerConnectionsRef.current.delete(socketId);
      removeRemoteStream(socketId);
    });

    socket.on("signal:offer", async ({ fromSocketId, sdp }) => {
      const connection = ensurePeerConnection(fromSocketId);
      await connection.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      socket.emit("signal:answer", {
        targetSocketId: fromSocketId,
        sdp: answer
      });
    });

    socket.on("signal:answer", async ({ fromSocketId, sdp }) => {
      const connection = ensurePeerConnection(fromSocketId);
      await connection.setRemoteDescription(new RTCSessionDescription(sdp));
    });

    socket.on("signal:ice-candidate", async ({ fromSocketId, candidate }) => {
      const connection = ensurePeerConnection(fromSocketId);
      if (candidate) {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    return () => {
      mounted = false;
      socket.off("room:participants");
      socket.off("room:user-joined");
      socket.off("room:user-left");
      socket.off("signal:offer");
      socket.off("signal:answer");
      socket.off("signal:ice-candidate");
      peerConnectionsRef.current.forEach((connection) => connection.close());
      peerConnectionsRef.current.clear();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
    };
  }, [socket, roomId, enabled, createOffer, ensurePeerConnection, initializeLocalMedia]);

  const toggleAudio = (enabledState) => {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = enabledState;
    });
  };

  const toggleVideo = (enabledState) => {
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = enabledState;
    });
  };

  const shareScreen = async () => {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const screenTrack = screenStream.getVideoTracks()[0];

    peerConnectionsRef.current.forEach((connection) => {
      const sender = connection.getSenders().find((item) => item.track?.kind === "video");
      if (sender) {
        sender.replaceTrack(screenTrack);
      }
    });

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = screenStream;
    }

    screenTrack.onended = async () => {
      const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
      peerConnectionsRef.current.forEach((connection) => {
        const sender = connection.getSenders().find((item) => item.track?.kind === "video");
        if (sender && cameraTrack) {
          sender.replaceTrack(cameraTrack);
        }
      });
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    };
  };

  return {
    localVideoRef,
    localStreamRef,
    participants,
    remoteStreams,
    toggleAudio,
    toggleVideo,
    shareScreen
  };
};

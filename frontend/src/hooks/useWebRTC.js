import { useCallback, useEffect, useRef, useState } from "react";

const RTC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

export const useWebRTC = ({ socket, roomId, enabled }) => {
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const pendingIceRef = useRef(new Map());
  const joinedRoomRef = useRef("");
  const [participants, setParticipants] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState({});

  const updateRemoteStream = (socketId, stream) => {
    setRemoteStreams((prev) => ({ ...prev, [socketId]: stream }));
  };

  const addLocalTracksToConnection = useCallback((connection) => {
    if (!connection || !localStreamRef.current) {
      return;
    }

    const existingTrackIds = new Set(
      connection
        .getSenders()
        .map((sender) => sender.track?.id)
        .filter(Boolean)
    );

    localStreamRef.current.getTracks().forEach((track) => {
      if (!existingTrackIds.has(track.id)) {
        connection.addTrack(track, localStreamRef.current);
      }
    });
  }, []);

  const removeRemoteStream = (socketId) => {
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
  };

  const queueIceCandidate = useCallback((socketId, candidate) => {
    if (!pendingIceRef.current.has(socketId)) {
      pendingIceRef.current.set(socketId, []);
    }
    pendingIceRef.current.get(socketId).push(candidate);
  }, []);

  const flushPendingIce = useCallback(async (socketId, connection) => {
    const pending = pendingIceRef.current.get(socketId) || [];
    if (!pending.length) {
      return;
    }
    for (const candidate of pending) {
      try {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("[webrtc] failed to add buffered ICE candidate", socketId, error);
      }
    }
    pendingIceRef.current.delete(socketId);
  }, []);

  const removePeerConnection = useCallback((socketId) => {
    const connection = peerConnectionsRef.current.get(socketId);
    if (connection) {
      connection.close();
    }
    peerConnectionsRef.current.delete(socketId);
    pendingIceRef.current.delete(socketId);
    removeRemoteStream(socketId);
  }, []);

  const ensurePeerConnection = useCallback(
    (targetSocketId) => {
      if (peerConnectionsRef.current.has(targetSocketId)) {
        return peerConnectionsRef.current.get(targetSocketId);
      }

      const connection = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionsRef.current.set(targetSocketId, connection);
      console.log("[webrtc] peer connection created", targetSocketId);
      addLocalTracksToConnection(connection);

      connection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("[webrtc] local ICE candidate", targetSocketId);
          socket.emit("signal:ice-candidate", {
            targetSocketId,
            candidate: event.candidate
          });
        }
      };

      connection.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream) {
          console.log("[webrtc] remote stream received", targetSocketId);
          updateRemoteStream(targetSocketId, stream);
        }
      };

      connection.onconnectionstatechange = () => {
        console.log("[webrtc] connection state", targetSocketId, connection.connectionState);
        if (["closed", "failed", "disconnected"].includes(connection.connectionState)) {
          removePeerConnection(targetSocketId);
        }
      };

      return connection;
    },
    [addLocalTracksToConnection, removePeerConnection, socket]
  );

  const createOfferForUser = useCallback(
    async (targetSocketId) => {
      try {
        const connection = ensurePeerConnection(targetSocketId);
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        console.log("[webrtc] sending offer", targetSocketId);
        socket.emit("signal:offer", {
          targetSocketId,
          sdp: offer
        });
      } catch (error) {
        console.error("[webrtc] failed to create/send offer", targetSocketId, error);
      }
    },
    [ensurePeerConnection, socket]
  );

  const shouldInitiateConnection = useCallback((selfSocketId, targetSocketId) => {
    if (!selfSocketId || !targetSocketId || selfSocketId === targetSocketId) {
      return false;
    }
    return selfSocketId.localeCompare(targetSocketId) > 0;
  }, []);

  const connectToNewUser = useCallback(
    async (targetSocketId) => {
      if (!socket?.id || !targetSocketId || targetSocketId === socket.id) {
        return;
      }

      ensurePeerConnection(targetSocketId);

      if (shouldInitiateConnection(socket.id, targetSocketId)) {
        await createOfferForUser(targetSocketId);
      }
    },
    [createOfferForUser, ensurePeerConnection, shouldInitiateConnection, socket?.id]
  );

  const initializeLocalMedia = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.muted = true;
      localVideoRef.current.play().catch(() => {});
    }

    peerConnectionsRef.current.forEach((connection, targetSocketId) => {
      addLocalTracksToConnection(connection);
      if (shouldInitiateConnection(socket?.id, targetSocketId)) {
        createOfferForUser(targetSocketId);
      }
    });

    console.log("[webrtc] local media initialized");
    return stream;
  }, [addLocalTracksToConnection, createOfferForUser, shouldInitiateConnection, socket?.id]);

  const emitJoinRoom = useCallback(() => {
    if (!socket || !roomId || !socket.connected) {
      return;
    }

    const joinKey = `${socket.id}:${roomId}`;
    if (joinedRoomRef.current === joinKey) {
      return;
    }

    console.log("[socket] joining room", roomId, "as", socket.id);
    socket.emit("join-room", { roomId, userId: socket.id });
    joinedRoomRef.current = joinKey;
  }, [socket, roomId]);

  useEffect(() => {
    if (!socket || !roomId || !enabled) {
      return undefined;
    }

    let mounted = true;

    const bootstrap = async () => {
      emitJoinRoom();
      try {
        await initializeLocalMedia();
      } catch (error) {
        console.warn("[webrtc] media initialization failed; joined room without local media", error);
      }
    };

    const onParticipants = (list) => {
      if (!mounted) {
        return;
      }
      console.log("[socket] room participants", list);
      setParticipants(list);
      list.forEach((participant) => {
        if (participant.socketId !== socket.id) {
          connectToNewUser(participant.socketId);
        }
      });
    };

    const onUserConnected = (payload) => {
      const participant =
        typeof payload === "string"
          ? { socketId: payload, userId: payload, name: `Participant ${payload.slice(0, 4)}` }
          : payload;

      if (!participant?.socketId) {
        return;
      }

      console.log("[socket] user connected", participant.socketId);
      setParticipants((prev) => {
        const exists = prev.some((item) => item.socketId === participant.socketId);
        if (exists) {
          return prev;
        }
        return [...prev, participant];
      });

      if (participant.socketId !== socket.id) {
        connectToNewUser(participant.socketId);
      }
    };

    const onUserLeft = ({ socketId }) => {
      console.log("[socket] user left", socketId);
      setParticipants((prev) => prev.filter((item) => item.socketId !== socketId));
      removePeerConnection(socketId);
    };

    const onOffer = async ({ fromSocketId, sdp, offer }) => {
      const remoteOffer = sdp || offer;
      if (!remoteOffer) {
        return;
      }

      try {
        console.log("[webrtc] offer received", fromSocketId);
        const connection = ensurePeerConnection(fromSocketId);
        await connection.setRemoteDescription(new RTCSessionDescription(remoteOffer));
        await flushPendingIce(fromSocketId, connection);
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        console.log("[webrtc] sending answer", fromSocketId);
        socket.emit("signal:answer", {
          targetSocketId: fromSocketId,
          sdp: answer
        });
      } catch (error) {
        console.error("[webrtc] failed handling offer", fromSocketId, error);
      }
    };

    const onAnswer = async ({ fromSocketId, sdp, answer }) => {
      const remoteAnswer = sdp || answer;
      if (!remoteAnswer) {
        return;
      }

      try {
        console.log("[webrtc] answer received", fromSocketId);
        const connection = ensurePeerConnection(fromSocketId);
        await connection.setRemoteDescription(new RTCSessionDescription(remoteAnswer));
        await flushPendingIce(fromSocketId, connection);
      } catch (error) {
        console.error("[webrtc] failed handling answer", fromSocketId, error);
      }
    };

    const onIceCandidate = async ({ fromSocketId, candidate }) => {
      if (!candidate) {
        return;
      }

      try {
        const connection = ensurePeerConnection(fromSocketId);
        if (!connection.remoteDescription) {
          queueIceCandidate(fromSocketId, candidate);
          return;
        }
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("[webrtc] failed adding ICE candidate", fromSocketId, error);
      }
    };

    const onConnect = async () => {
      console.log("[socket] connected", socket.id);
      joinedRoomRef.current = "";
      emitJoinRoom();
      try {
        await initializeLocalMedia();
      } catch (error) {
        console.warn("[webrtc] media initialization failed after reconnect", error);
      }
    };

    const onDisconnect = (reason) => {
      console.log("[socket] disconnected", reason);
      joinedRoomRef.current = "";
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    socket.on("room:participants", onParticipants);
    socket.on("user-connected", onUserConnected);
    socket.on("room:user-joined", onUserConnected);
    socket.on("room:user-left", onUserLeft);
    socket.on("signal:offer", onOffer);
    socket.on("signal:answer", onAnswer);
    socket.on("signal:ice-candidate", onIceCandidate);

    bootstrap();

    return () => {
      mounted = false;
      joinedRoomRef.current = "";
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:participants", onParticipants);
      socket.off("user-connected", onUserConnected);
      socket.off("room:user-joined", onUserConnected);
      socket.off("room:user-left", onUserLeft);
      socket.off("signal:offer", onOffer);
      socket.off("signal:answer", onAnswer);
      socket.off("signal:ice-candidate", onIceCandidate);
      peerConnectionsRef.current.forEach((connection) => connection.close());
      peerConnectionsRef.current.clear();
      pendingIceRef.current.clear();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
    };
  }, [
    socket,
    roomId,
    enabled,
    connectToNewUser,
    ensurePeerConnection,
    flushPendingIce,
    initializeLocalMedia,
    emitJoinRoom,
    queueIceCandidate,
    removePeerConnection
  ]);

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
      localVideoRef.current.play().catch(() => {});
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
        localVideoRef.current.play().catch(() => {});
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

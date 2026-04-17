import { useCallback, useEffect, useRef, useState } from "react";

const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ]
};

export const useWebRTC = ({ socket, roomId, enabled, currentUser, sessionStore = null }) => {
  const fallbackLocalVideoRef = useRef(null);
  const fallbackLocalStreamRef = useRef(null);
  const fallbackScreenStreamRef = useRef(null);
  const fallbackPeerConnectionsRef = useRef(new Map());
  const fallbackPendingIceRef = useRef(new Map());
  const fallbackJoinedRoomRef = useRef("");

  const localVideoRef = sessionStore?.localVideoRef || fallbackLocalVideoRef;
  const localStreamRef = sessionStore?.localStreamRef || fallbackLocalStreamRef;
  const screenStreamRef = sessionStore?.screenStreamRef || fallbackScreenStreamRef;
  const peerConnectionsRef = sessionStore?.peerConnectionsRef || fallbackPeerConnectionsRef;
  const pendingIceRef = sessionStore?.pendingIceRef || fallbackPendingIceRef;
  const joinedRoomRef = sessionStore?.joinedRoomRef || fallbackJoinedRoomRef;

  const fallbackParticipantsState = useState([]);
  const fallbackRemoteStreamsState = useState({});
  const participants = sessionStore?.participants ?? fallbackParticipantsState[0];
  const setParticipants = sessionStore?.setParticipants ?? fallbackParticipantsState[1];
  const remoteStreams = sessionStore?.remoteStreams ?? fallbackRemoteStreamsState[0];
  const setRemoteStreams = sessionStore?.setRemoteStreams ?? fallbackRemoteStreamsState[1];

  const normalizeParticipants = useCallback((list) => {
    return (Array.isArray(list) ? list : [])
      .filter(Boolean)
      .map((participant) => {
        if (typeof participant === "string") {
          return {
            socketId: participant,
            userId: participant,
            name: `Participant ${participant.slice(0, 4)}`,
            role: "student"
          };
        }

        const socketId = participant.socketId || participant.userId || participant.id;
        return {
          socketId,
          userId: participant.userId || participant.id || socketId,
          name: participant.name || `Participant ${String(socketId).slice(0, 4)}`,
          role: participant.role || "student",
          isMuted: Boolean(participant.isMuted),
          isCameraOff: Boolean(participant.isCameraOff),
          isSharingScreen: Boolean(participant.isSharingScreen)
        };
      })
      .filter((participant) => participant.socketId);
  }, []);

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
          console.log("ICE candidate exchanged", { to: targetSocketId });
          socket.emit("ice-candidate", {
            targetSocketId,
            to: targetSocketId,
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
        console.log("Offer sent");
        socket.emit("offer", {
          targetSocketId,
          to: targetSocketId,
          offer,
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
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.muted = true;
        localVideoRef.current.play().catch(() => {});
      }
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
    if (!socket || !roomId) {
      return;
    }

    const joinKey = `${socket.id || "pending"}:${roomId}`;
    if (joinedRoomRef.current === joinKey) {
      return;
    }

    console.log("Joining room:", roomId);
    socket.emit(
      "join-room",
      {
        roomId,
        userId: currentUser?.id || socket.id,
        name: currentUser?.name,
        role: currentUser?.role
      },
      (ack) => {
        console.log("[socket] join-room ack", ack);
        if (Array.isArray(ack?.participants)) {
          const normalized = normalizeParticipants(ack.participants);
          const selfParticipant = {
            socketId: socket?.id,
            userId: currentUser?.id || socket?.id,
            name: currentUser?.name || "You",
            role: currentUser?.role || "student"
          };
          const withSelf = normalized.some((item) => item.socketId === selfParticipant.socketId)
            ? normalized
            : [selfParticipant, ...normalized].filter((item) => item.socketId);

          setParticipants(withSelf);
          normalized.forEach((participant) => {
            if (participant.socketId !== socket?.id) {
              connectToNewUser(participant.socketId);
            }
          });
        }
      }
    );
    socket.emit("room:get-participants", { roomId });
    joinedRoomRef.current = joinKey;
  }, [socket, roomId, currentUser?.id, currentUser?.name, currentUser?.role, connectToNewUser, normalizeParticipants]);

  useEffect(() => {
    if (!socket || !roomId || !enabled) {
      return undefined;
    }

    let mounted = true;

    const bootstrap = async () => {
      try {
        await initializeLocalMedia();
      } catch (error) {
        console.warn("[webrtc] media initialization failed; joined room without local media", error);
      }
      emitJoinRoom();
    };

    const onParticipants = (list) => {
      if (!mounted) {
        return;
      }
      const normalized = normalizeParticipants(list);
      const selfParticipant = {
        socketId: socket?.id,
        userId: currentUser?.id || socket?.id,
        name: currentUser?.name || "You",
        role: currentUser?.role || "student"
      };
      const withSelf = normalized.some((item) => item.socketId === selfParticipant.socketId)
        ? normalized
        : [selfParticipant, ...normalized].filter((item) => item.socketId);

      console.log("[socket] room participants", withSelf);
      setParticipants(withSelf);
      withSelf.forEach((participant) => {
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

      console.log("User connected:", participant.socketId);
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

    const onOffer = async ({ fromSocketId, from, sdp, offer }) => {
      const remoteSocketId = fromSocketId || from;
      const remoteOffer = sdp || offer;
      if (!remoteOffer) {
        return;
      }

      try {
        console.log("[webrtc] offer received", remoteSocketId);
        const connection = ensurePeerConnection(remoteSocketId);
        await connection.setRemoteDescription(new RTCSessionDescription(remoteOffer));
        await flushPendingIce(remoteSocketId, connection);
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        console.log("[webrtc] sending answer", remoteSocketId);
        socket.emit("answer", {
          targetSocketId: remoteSocketId,
          to: remoteSocketId,
          answer,
          sdp: answer
        });
      } catch (error) {
        console.error("[webrtc] failed handling offer", remoteSocketId, error);
      }
    };

    const onAnswer = async ({ fromSocketId, from, sdp, answer }) => {
      const remoteSocketId = fromSocketId || from;
      const remoteAnswer = sdp || answer;
      if (!remoteAnswer) {
        return;
      }

      try {
        console.log("Answer received");
        const connection = ensurePeerConnection(remoteSocketId);
        await connection.setRemoteDescription(new RTCSessionDescription(remoteAnswer));
        await flushPendingIce(remoteSocketId, connection);
      } catch (error) {
        console.error("[webrtc] failed handling answer", remoteSocketId, error);
      }
    };

    const onIceCandidate = async ({ fromSocketId, from, candidate }) => {
      const remoteSocketId = fromSocketId || from;
      if (!candidate) {
        return;
      }

      try {
        const connection = ensurePeerConnection(remoteSocketId);
        if (!connection.remoteDescription) {
          queueIceCandidate(remoteSocketId, candidate);
          return;
        }
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("[webrtc] failed adding ICE candidate", remoteSocketId, error);
      }
    };

    const onConnect = async () => {
      console.log("Connected:", socket.id);
      joinedRoomRef.current = "";
      try {
        await initializeLocalMedia();
      } catch (error) {
        console.warn("[webrtc] media initialization failed after reconnect", error);
      }
      emitJoinRoom();
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
    socket.on("offer", onOffer);
    socket.on("answer", onAnswer);
    socket.on("ice-candidate", onIceCandidate);

    const participantSyncTimer = setInterval(() => {
      socket.emit("room:get-participants", { roomId });
    }, 3000);

    bootstrap();

    return () => {
      mounted = false;
      clearInterval(participantSyncTimer);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:participants", onParticipants);
      socket.off("user-connected", onUserConnected);
      socket.off("room:user-joined", onUserConnected);
      socket.off("room:user-left", onUserLeft);
      socket.off("offer", onOffer);
      socket.off("answer", onAnswer);
      socket.off("ice-candidate", onIceCandidate);

      const shouldKeepAlive = Boolean(
        sessionStore?.keepAliveOnUnmountRef?.current && roomId && enabled
      );

      if (shouldKeepAlive) {
        return;
      }

      joinedRoomRef.current = "";

      peerConnectionsRef.current.forEach((connection) => connection.close());
      peerConnectionsRef.current.clear();
      pendingIceRef.current.clear();
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
    };
  }, [
    socket,
    roomId,
    enabled,
    sessionStore?.keepAliveOnUnmountRef,
    connectToNewUser,
    normalizeParticipants,
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

  const stopScreenShare = useCallback(() => {
    const activeScreenStream = screenStreamRef.current;
    if (!activeScreenStream) {
      return false;
    }

    activeScreenStream.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    screenStreamRef.current = null;

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

    return false;
  }, []);

  const shareScreen = useCallback(async () => {
    if (screenStreamRef.current) {
      return stopScreenShare();
    }

    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const screenTrack = screenStream.getVideoTracks()[0];
    screenStreamRef.current = screenStream;

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

    screenTrack.onended = () => {
      stopScreenShare();
    };

    return true;
  }, [stopScreenShare]);

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

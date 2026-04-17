import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { createSignalingSocket } from "../api/socket";

const WebRTCContext = createContext(null);

export const WebRTCProvider = ({ children }) => {
  const socketRef = useRef(null);
  const socketTokenRef = useRef(null);

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const pendingIceRef = useRef(new Map());
  const joinedRoomRef = useRef("");
  const keepAliveOnUnmountRef = useRef(true);

  const [participants, setParticipants] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState({});

  const getOrCreateSocket = useCallback((token) => {
    if (!token) {
      return null;
    }

    if (!socketRef.current) {
      socketRef.current = createSignalingSocket(token);
      socketTokenRef.current = token;
      return socketRef.current;
    }

    if (socketTokenRef.current !== token) {
      socketRef.current.disconnect();
      socketRef.current = createSignalingSocket(token);
      socketTokenRef.current = token;
    }

    return socketRef.current;
  }, []);

  const clearSession = useCallback(({ disconnectSocket = false } = {}) => {
    peerConnectionsRef.current.forEach((connection) => connection.close());
    peerConnectionsRef.current.clear();
    pendingIceRef.current.clear();
    joinedRoomRef.current = "";

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    setParticipants([]);
    setRemoteStreams({});

    if (disconnectSocket && socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      socketTokenRef.current = null;
    }
  }, []);

  const value = useMemo(
    () => ({
      getOrCreateSocket,
      clearSession,
      socketRef,
      localVideoRef,
      localStreamRef,
      screenStreamRef,
      peerConnectionsRef,
      pendingIceRef,
      joinedRoomRef,
      keepAliveOnUnmountRef,
      participants,
      setParticipants,
      remoteStreams,
      setRemoteStreams
    }),
    [clearSession, getOrCreateSocket, participants, remoteStreams]
  );

  return <WebRTCContext.Provider value={value}>{children}</WebRTCContext.Provider>;
};

export const useWebRTCContext = () => {
  const context = useContext(WebRTCContext);
  if (!context) {
    throw new Error("useWebRTCContext must be used inside WebRTCProvider");
  }
  return context;
};

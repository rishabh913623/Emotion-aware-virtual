import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { signalingClient, aiClient, attachAuthToken } from "../api/client";
import { createSignalingSocket } from "../api/socket";
import { useAuth } from "../context/AuthContext";
import { useWebRTC } from "../hooks/useWebRTC";
import { useEmotionCapture } from "../hooks/useEmotionCapture";
import VideoGrid from "../components/classroom/VideoGrid";
import ControlsBar from "../components/classroom/ControlsBar";
import ChatSidebar from "../components/classroom/ChatSidebar";
import EmotionSidebar from "../components/classroom/EmotionSidebar";
import ParticipantPanel from "../components/classroom/ParticipantPanel";

const ClassroomPage = () => {
  const navigate = useNavigate();
  const { auth, logout } = useAuth();
  const currentUser = auth?.user;
  const [roomId, setRoomId] = useState("");
  const [activeRoomId, setActiveRoomId] = useState("");
  const [messages, setMessages] = useState([]);
  const [quiz, setQuiz] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [sharing, setSharing] = useState(false);

  const socket = useMemo(() => {
    if (!auth?.token) {
      return null;
    }
    return createSignalingSocket(auth.token);
  }, [auth?.token]);

  useEffect(() => {
    if (auth?.token) {
      attachAuthToken(auth.token);
    }
  }, [auth?.token]);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const onSocketAuthError = (error) => {
      const message = error?.message || "Socket connection failed";
      console.error("[socket] connect_error", message);
      if (message.includes("Invalid socket token") || message.includes("Missing socket token")) {
        alert("Session expired. Please login again.");
        logout();
        navigate("/auth");
      }
    };

    socket.on("chat:message", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on("connect_error", onSocketAuthError);

    socket.on("room:removed", () => {
      setActiveRoomId("");
      alert("Instructor removed you from this room.");
    });

    socket.on("room:force-muted", () => {
      setAudioEnabled(false);
    });

    return () => {
      socket.off("connect_error", onSocketAuthError);
      socket.disconnect();
    };
  }, [socket, logout, navigate]);

  useEffect(() => {
    if (!socket || !activeRoomId) {
      return undefined;
    }

    const emitJoinRoom = () => {
      console.log("Joining room:", activeRoomId);
      socket.emit(
        "join-room",
        {
          roomId: activeRoomId,
          userId: currentUser?.id || socket.id,
          name: currentUser?.name,
          role: currentUser?.role
        },
        (ack) => {
          console.log("[socket] join-room ack", ack);
        }
      );
    };

    if (socket.connected) {
      emitJoinRoom();
    }

    socket.on("connect", emitJoinRoom);
    const retryTimer = setTimeout(emitJoinRoom, 1000);

    return () => {
      clearTimeout(retryTimer);
      socket.off("connect", emitJoinRoom);
    };
  }, [socket, activeRoomId, currentUser?.id, currentUser?.name, currentUser?.role]);

  const { localVideoRef, participants, remoteStreams, toggleAudio, toggleVideo, shareScreen } = useWebRTC({
    socket,
    roomId: activeRoomId,
    enabled: Boolean(activeRoomId),
    currentUser
  });

  const { currentEmotion, history, error } = useEmotionCapture({
    enabled: Boolean(activeRoomId) && currentUser?.role === "student",
    userId: currentUser?.id,
    roomId: activeRoomId,
    videoRef: localVideoRef
  });

  const emitRoomJoin = (targetRoomId) => {
    if (!socket || !targetRoomId) {
      return;
    }

    console.log("Joining room:", targetRoomId);
    socket.emit(
      "join-room",
      {
        roomId: targetRoomId,
        userId: currentUser?.id || socket.id,
        name: currentUser?.name,
        role: currentUser?.role
      },
      (ack) => {
        console.log("[socket] join-room ack", ack);
      }
    );
  };

  if (!currentUser) {
    return null;
  }

  const createRoom = async () => {
    const response = await signalingClient.post("/api/rooms");
    const newRoom = response.data.room.id;
    setRoomId(newRoom);
    setActiveRoomId(newRoom);
    emitRoomJoin(newRoom);
  };

  const joinRoom = () => {
    if (!roomId.trim()) {
      return;
    }
    const selectedRoomId = roomId.trim();
    setActiveRoomId(selectedRoomId);
    emitRoomJoin(selectedRoomId);
  };

  const sendMessage = (message) => {
    if (!socket || !activeRoomId) {
      return;
    }
    socket.emit("chat:message", { roomId: activeRoomId, message });
  };

  const handleMuteParticipant = (targetSocketId) => {
    socket?.emit("room:moderation", {
      roomId: activeRoomId,
      action: "mute",
      targetSocketId
    });
  };

  const handleRemoveParticipant = (targetSocketId) => {
    socket?.emit("room:moderation", {
      roomId: activeRoomId,
      action: "remove",
      targetSocketId
    });
  };

  const generateQuiz = async () => {
    const response = await aiClient.get(`/generate-quiz?student_id=${currentUser.id}`);
    setQuiz(response.data);
  };

  const toggleMic = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    toggleAudio(next);
    socket?.emit("room:update-state", { roomId: activeRoomId, patch: { isMuted: !next } });
  };

  const toggleCam = () => {
    const next = !videoEnabled;
    setVideoEnabled(next);
    toggleVideo(next);
    socket?.emit("room:update-state", { roomId: activeRoomId, patch: { isCameraOff: !next } });
  };

  const handleShare = async () => {
    await shareScreen();
    const next = !sharing;
    setSharing(next);
    socket?.emit("room:update-state", { roomId: activeRoomId, patch: { isSharingScreen: next } });
  };

  const leaveRoom = () => {
    setActiveRoomId("");
    setMessages([]);
    localStorage.removeItem("last_room_id");
  };

  useEffect(() => {
    if (activeRoomId) {
      localStorage.setItem("last_room_id", activeRoomId);
    }
  }, [activeRoomId]);

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <header className="mx-auto mb-4 flex max-w-7xl items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Virtual Classroom</h1>
          <p className="text-sm text-slate-500">Role: {currentUser.role}</p>
        </div>
        <div className="flex items-center gap-2">
          {currentUser.role === "instructor" && (
            <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white" onClick={() => navigate("/dashboard")}>
              Dashboard
            </button>
          )}
          <button
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
            onClick={() => {
              logout();
              navigate("/auth");
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {!activeRoomId && (
        <div className="mx-auto mb-4 max-w-7xl rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Enter room ID"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
            />
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white" onClick={joinRoom}>
              Join Room
            </button>
            {currentUser.role === "instructor" && (
              <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white" onClick={createRoom}>
                Create Room
              </button>
            )}
          </div>
        </div>
      )}

      {activeRoomId && (
        <main className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[2fr_1fr]">
          <section className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
              Active Room ID: <span className="font-semibold text-slate-900">{activeRoomId}</span>
            </div>
            <VideoGrid
              localVideoRef={localVideoRef}
              remoteStreams={remoteStreams}
              participants={participants}
              selfName={currentUser.name}
              selfSocketId={socket?.id}
            />
            <ControlsBar
              audioEnabled={audioEnabled}
              videoEnabled={videoEnabled}
              sharing={sharing}
              onToggleAudio={toggleMic}
              onToggleVideo={toggleCam}
              onShare={handleShare}
              onLeave={leaveRoom}
            />
            <ParticipantPanel
              participants={participants}
              canModerate={currentUser.role === "instructor"}
              onMute={handleMuteParticipant}
              onRemove={handleRemoveParticipant}
            />
          </section>

          <section className="grid gap-4">
            <ChatSidebar messages={messages} onSend={sendMessage} />
            {currentUser.role === "student" && (
              <EmotionSidebar
                currentEmotion={currentEmotion}
                history={history}
                error={error}
                quiz={quiz}
                onGenerateQuiz={generateQuiz}
              />
            )}
          </section>
        </main>
      )}
    </div>
  );
};

export default ClassroomPage;

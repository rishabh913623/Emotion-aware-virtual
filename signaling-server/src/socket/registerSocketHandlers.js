import { verifyToken } from "../utils/jwt.js";
import {
  addParticipant,
  findParticipantBySocket,
  getParticipants,
  removeParticipant,
  updateParticipant
} from "./roomStore.js";

const logSocket = (socket, message, meta = {}) => {
  console.log(`[socket] ${message}`, {
    socketId: socket.id,
    userId: socket.user?.id,
    ...meta
  });
};

const socketAuth = (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Missing socket token"));
    }
    socket.user = verifyToken(token);
    return next();
  } catch (error) {
    return next(new Error("Invalid socket token"));
  }
};

export const registerSocketHandlers = (io) => {
  io.use(socketAuth);

  io.on("connection", (socket) => {
    logSocket(socket, "connected");

    socket.onAny((eventName, payload) => {
      if (["join-room", "offer", "answer", "ice-candidate", "room:join"].includes(eventName)) {
        logSocket(socket, `event:${eventName}`, { payload });
      }
    });

    const joinRoom = ({ roomId, userId, name, role } = {}, callback) => {
      if (!roomId) {
        logSocket(socket, "join-room rejected: missing roomId");
        socket.emit("room:error", { error: "roomId is required" });
        if (typeof callback === "function") {
          callback({ ok: false, error: "roomId is required" });
        }
        return;
      }

      const previous = findParticipantBySocket(socket.id);
      if (previous && previous.roomId !== roomId) {
        socket.leave(previous.roomId);
        removeParticipant(previous.roomId, socket.id);
        io.to(previous.roomId).emit("room:participants", getParticipants(previous.roomId));
        io.to(previous.roomId).emit("room:user-left", {
          socketId: socket.id,
          userId: previous.participant.userId
        });
      }

      socket.join(roomId);

      const participant = {
        socketId: socket.id,
        userId: userId || socket.user.id,
        name: name || socket.user.name,
        role: role || socket.user.role,
        isMuted: false,
        isCameraOff: false,
        isSharingScreen: false
      };

      addParticipant(roomId, participant);
      const participants = getParticipants(roomId);
      logSocket(socket, "joined room", {
        roomId,
        existingCount: Math.max(0, participants.length - 1)
      });

      socket.emit("room:participants", participants);
      socket.to(roomId).emit("user-connected", participant);
      socket.to(roomId).emit("room:user-joined", participant);
      io.to(roomId).emit("room:participants", participants);
      if (typeof callback === "function") {
        callback({ ok: true, roomId, participants, participantCount: participants.length });
      }
    };

    socket.on("join-room", joinRoom);
    socket.on("room:join", joinRoom);

    socket.on("room:get-participants", ({ roomId } = {}) => {
      if (!roomId) {
        return;
      }
      socket.emit("room:participants", getParticipants(roomId));
    });

    const forwardOffer = ({ targetSocketId, to, sdp, offer }) => {
      const recipientSocketId = targetSocketId || to;
      const sessionDescription = sdp || offer;
      if (!recipientSocketId || !sessionDescription) {
        return;
      }
      logSocket(socket, "offer", { targetSocketId });
      io.to(recipientSocketId).emit("offer", {
        fromSocketId: socket.id,
        from: socket.id,
        offer: sessionDescription,
        sdp: sessionDescription
      });
    };

    socket.on("signal:offer", forwardOffer);
    socket.on("offer", forwardOffer);

    const forwardAnswer = ({ targetSocketId, to, sdp, answer }) => {
      const recipientSocketId = targetSocketId || to;
      const sessionDescription = sdp || answer;
      if (!recipientSocketId || !sessionDescription) {
        return;
      }
      logSocket(socket, "answer", { targetSocketId });
      io.to(recipientSocketId).emit("answer", {
        fromSocketId: socket.id,
        from: socket.id,
        answer: sessionDescription,
        sdp: sessionDescription
      });
    };

    socket.on("signal:answer", forwardAnswer);
    socket.on("answer", forwardAnswer);

    const forwardIce = ({ targetSocketId, to, candidate }) => {
      const recipientSocketId = targetSocketId || to;
      if (!recipientSocketId || !candidate) {
        return;
      }
      logSocket(socket, "ice-candidate", { targetSocketId });
      io.to(recipientSocketId).emit("ice-candidate", {
        fromSocketId: socket.id,
        from: socket.id,
        candidate
      });
    };

    socket.on("signal:ice-candidate", forwardIce);
    socket.on("ice-candidate", forwardIce);

    socket.on("chat:message", ({ roomId, message }) => {
      io.to(roomId).emit("chat:message", {
        id: `${Date.now()}-${socket.id}`,
        sender: socket.user.name,
        senderRole: socket.user.role,
        message,
        timestamp: new Date().toISOString()
      });
    });

    socket.on("screen-share-started", ({ roomId, socketId, name }) => {
      if (!roomId) {
        return;
      }

      socket.to(roomId).emit("screen-share-started", {
        roomId,
        socketId: socketId || socket.id,
        name: name || socket.user.name
      });
    });

    socket.on("screen-share-stopped", ({ roomId, socketId }) => {
      if (!roomId) {
        return;
      }

      socket.to(roomId).emit("screen-share-stopped", {
        roomId,
        socketId: socketId || socket.id
      });
    });

    socket.on("new-quiz", ({ roomId, questions, title }) => {
      if (!roomId || !Array.isArray(questions) || !questions.length) {
        return;
      }

      if (socket.user.role !== "instructor") {
        return;
      }

      io.to(roomId).emit("new-quiz", {
        roomId,
        title: title || "Class Quiz",
        questions,
        fromSocketId: socket.id,
        instructor: socket.user.name
      });
    });

    socket.on("room:update-state", ({ roomId, patch }) => {
      updateParticipant(roomId, socket.id, patch);
      const updatedParticipants = getParticipants(roomId);
      io.to(roomId).emit("room:participants", updatedParticipants);
    });

    socket.on("room:moderation", ({ roomId, action, targetSocketId }) => {
      if (socket.user.role !== "instructor") {
        return;
      }
      if (action === "remove") {
        io.to(targetSocketId).emit("room:removed", { by: socket.user.name });
        io.sockets.sockets.get(targetSocketId)?.leave(roomId);
      }
      if (action === "mute") {
        io.to(targetSocketId).emit("room:force-muted", { by: socket.user.name });
      }
    });

    socket.on("disconnect", () => {
      const found = findParticipantBySocket(socket.id);
      if (!found) {
        logSocket(socket, "disconnected (not in room)");
        return;
      }
      logSocket(socket, "disconnected", { roomId: found.roomId });
      removeParticipant(found.roomId, socket.id);
      socket.to(found.roomId).emit("room:user-left", {
        socketId: socket.id,
        userId: found.participant.userId
      });
      io.to(found.roomId).emit("room:participants", getParticipants(found.roomId));
    });
  });
};

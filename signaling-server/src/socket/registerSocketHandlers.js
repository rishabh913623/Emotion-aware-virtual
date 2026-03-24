import { verifyToken } from "../utils/jwt.js";
import {
  addParticipant,
  findParticipantBySocket,
  getParticipants,
  removeParticipant,
  updateParticipant
} from "./roomStore.js";

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
    socket.on("room:join", ({ roomId }) => {
      const existingParticipants = getParticipants(roomId);
      socket.join(roomId);

      const participant = {
        socketId: socket.id,
        userId: socket.user.id,
        name: socket.user.name,
        role: socket.user.role,
        isMuted: false,
        isCameraOff: false,
        isSharingScreen: false
      };

      addParticipant(roomId, participant);

      socket.emit("room:participants", existingParticipants);
      socket.to(roomId).emit("room:user-joined", participant);
      io.to(roomId).emit("room:participants", getParticipants(roomId));
    });

    socket.on("signal:offer", ({ targetSocketId, sdp }) => {
      io.to(targetSocketId).emit("signal:offer", {
        fromSocketId: socket.id,
        sdp
      });
    });

    socket.on("signal:answer", ({ targetSocketId, sdp }) => {
      io.to(targetSocketId).emit("signal:answer", {
        fromSocketId: socket.id,
        sdp
      });
    });

    socket.on("signal:ice-candidate", ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit("signal:ice-candidate", {
        fromSocketId: socket.id,
        candidate
      });
    });

    socket.on("chat:message", ({ roomId, message }) => {
      io.to(roomId).emit("chat:message", {
        id: `${Date.now()}-${socket.id}`,
        sender: socket.user.name,
        senderRole: socket.user.role,
        message,
        timestamp: new Date().toISOString()
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
        return;
      }
      removeParticipant(found.roomId, socket.id);
      socket.to(found.roomId).emit("room:user-left", {
        socketId: socket.id,
        userId: found.participant.userId
      });
      io.to(found.roomId).emit("room:participants", getParticipants(found.roomId));
    });
  });
};

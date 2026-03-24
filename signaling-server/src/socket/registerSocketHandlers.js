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

    const joinRoom = ({ roomId }) => {
      if (!roomId) {
        logSocket(socket, "join-room rejected: missing roomId");
        socket.emit("room:error", { error: "roomId is required" });
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
      logSocket(socket, "joined room", {
        roomId,
        existingCount: existingParticipants.length
      });

      socket.emit("room:participants", existingParticipants);
      socket.to(roomId).emit("user-connected", participant);
      socket.to(roomId).emit("room:user-joined", participant);
      io.to(roomId).emit("room:participants", getParticipants(roomId));
    };

    socket.on("join-room", joinRoom);
    socket.on("room:join", joinRoom);

    const forwardOffer = ({ targetSocketId, sdp }) => {
      logSocket(socket, "offer", { targetSocketId });
      io.to(targetSocketId).emit("signal:offer", {
        fromSocketId: socket.id,
        sdp
      });
    };

    socket.on("signal:offer", forwardOffer);
    socket.on("offer", ({ targetSocketId, offer }) =>
      forwardOffer({ targetSocketId, sdp: offer })
    );

    const forwardAnswer = ({ targetSocketId, sdp }) => {
      logSocket(socket, "answer", { targetSocketId });
      io.to(targetSocketId).emit("signal:answer", {
        fromSocketId: socket.id,
        sdp
      });
    };

    socket.on("signal:answer", forwardAnswer);
    socket.on("answer", ({ targetSocketId, answer }) =>
      forwardAnswer({ targetSocketId, sdp: answer })
    );

    const forwardIce = ({ targetSocketId, candidate }) => {
      logSocket(socket, "ice-candidate", { targetSocketId });
      io.to(targetSocketId).emit("signal:ice-candidate", {
        fromSocketId: socket.id,
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

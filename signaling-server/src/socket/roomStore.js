const roomParticipants = new Map();

export const addParticipant = (roomId, participant) => {
  if (!roomParticipants.has(roomId)) {
    roomParticipants.set(roomId, new Map());
  }
  roomParticipants.get(roomId).set(participant.socketId, participant);
};

export const removeParticipant = (roomId, socketId) => {
  if (!roomParticipants.has(roomId)) {
    return;
  }
  roomParticipants.get(roomId).delete(socketId);
  if (roomParticipants.get(roomId).size === 0) {
    roomParticipants.delete(roomId);
  }
};

export const getParticipants = (roomId) => {
  if (!roomParticipants.has(roomId)) {
    return [];
  }
  return Array.from(roomParticipants.get(roomId).values());
};

export const findParticipantBySocket = (socketId) => {
  for (const [roomId, participantsMap] of roomParticipants.entries()) {
    if (participantsMap.has(socketId)) {
      return { roomId, participant: participantsMap.get(socketId) };
    }
  }
  return null;
};

export const updateParticipant = (roomId, socketId, patch) => {
  if (!roomParticipants.has(roomId)) {
    return;
  }
  const participants = roomParticipants.get(roomId);
  if (!participants.has(socketId)) {
    return;
  }
  participants.set(socketId, { ...participants.get(socketId), ...patch });
};

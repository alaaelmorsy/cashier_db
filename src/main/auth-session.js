'use strict';

function validSenderId(senderId) {
  return Number.isInteger(senderId) && senderId > 0;
}

function sanitizedUser(user) {
  if (!user || !Number.isInteger(Number(user.id)) || !user.username || !user.role) {
    throw new Error('Valid authenticated user is required');
  }

  return {
    id: Number(user.id),
    username: String(user.username),
    full_name: user.full_name ? String(user.full_name) : '',
    role: String(user.role),
  };
}

function createSenderSessionStore() {
  const usersBySender = new Map();

  return {
    bind(senderId, user) {
      if (!validSenderId(senderId)) throw new Error('Valid sender id is required');
      usersBySender.set(senderId, sanitizedUser(user));
    },
    current(senderId) {
      if (!validSenderId(senderId)) return null;
      const user = usersBySender.get(senderId);
      return user ? { ...user } : null;
    },
    clear(senderId) {
      if (validSenderId(senderId)) usersBySender.delete(senderId);
    },
  };
}

module.exports = { createSenderSessionStore };

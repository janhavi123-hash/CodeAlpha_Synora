const rooms = {}; // { roomId: [socketId1, socketId2, ...] }
const whiteboardHistory = {}; // { roomId: [ {fromX, fromY, toX, toY, color, width}, ... ] }
const chatHistory = {}; // { roomId: [ {message, from}, ... ] }
const roomUserMap = {}; // { roomId: { userId: socketId } }

const jwt = require('jsonwebtoken');

// Verify every socket connection has a valid login token
const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded; // { id, name, email }
    next();
  } catch (err) {
    next(new Error('Invalid or expired token'));
  }
};

const setupSignaling = (io) => {
  io.use(authenticateSocket);
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', (roomId) => {
  const userId = socket.user.id;

  if (!roomUserMap[roomId]) roomUserMap[roomId] = {};

  // If this same logged-in user already has an active connection in this room
  // (e.g. their old connection hasn't timed out yet after a reconnect), force it out first
  const existingSocketId = roomUserMap[roomId][userId];
  if (existingSocketId && existingSocketId !== socket.id) {
    rooms[roomId] = (rooms[roomId] || []).filter((id) => id !== existingSocketId);
    io.to(roomId).emit('user-left', existingSocketId);
    console.log(`Removed stale connection ${existingSocketId} for user ${userId} in room ${roomId}`);
  }

  roomUserMap[roomId][userId] = socket.id;

  socket.join(roomId);

  if (!rooms[roomId]) rooms[roomId] = [];
  rooms[roomId].push(socket.id);

  socket.to(roomId).emit('user-joined', socket.id);

  socket.roomId = roomId;
  socket.userId = userId;

  if (whiteboardHistory[roomId]) {
    socket.emit('whiteboard-history', whiteboardHistory[roomId]);
  }

  if (chatHistory[roomId]) {
    socket.emit('chat-history', chatHistory[roomId]);
  }
});

    // relay WebRTC offer to the other person
    socket.on('offer', ({ roomId, offer, to }) => {
      socket.to(to).emit('offer', { offer, from: socket.id });
    });

    // relay WebRTC answer back
    socket.on('answer', ({ answer, to }) => {
      socket.to(to).emit('answer', { answer, from: socket.id });
    });

    // relay ICE candidates (connection info) between peers
    socket.on('ice-candidate', ({ candidate, to }) => {
      socket.to(to).emit('ice-candidate', { candidate, from: socket.id });
    });

   socket.on('chat-message', ({ roomId, message }) => {
  const chatData = { message, from: socket.user.name };

  if (!chatHistory[roomId]) chatHistory[roomId] = [];
  chatHistory[roomId].push(chatData);

  socket.to(roomId).emit('chat-message', chatData);
});

socket.on('user-status', ({ roomId, name, micOn, camOn }) => {
  socket.to(roomId).emit('user-status', { id: socket.id, name, micOn, camOn });
});

socket.on('whiteboard-draw', (data) => {
  const { roomId } = data;
  if (!whiteboardHistory[roomId]) whiteboardHistory[roomId] = [];
  whiteboardHistory[roomId].push(data);

  socket.to(roomId).emit('whiteboard-draw', data);
});

socket.on('whiteboard-clear', ({ roomId }) => {
  whiteboardHistory[roomId] = [];
  socket.to(roomId).emit('whiteboard-clear');
});

    socket.on('disconnect', () => {
  const roomId = socket.roomId;
  if (roomId && rooms[roomId]) {
    rooms[roomId] = rooms[roomId].filter((id) => id !== socket.id);
    socket.to(roomId).emit('user-left', socket.id);

    // Only clear the user-map entry if this socket is still the "current" one for that user
    if (roomUserMap[roomId] && roomUserMap[roomId][socket.userId] === socket.id) {
      delete roomUserMap[roomId][socket.userId];
    }
  }
  console.log('User disconnected:', socket.id);
});
  });
};

module.exports = setupSignaling;
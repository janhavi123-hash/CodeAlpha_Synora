const rooms = {}; // { roomId: [socketId1, socketId2, ...] }
const whiteboardHistory = {}; // { roomId: [ {fromX, fromY, toX, toY, color, width}, ... ] }
const chatHistory = {}; // { roomId: [ {message, from}, ... ] }

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
  socket.join(roomId);

  if (!rooms[roomId]) rooms[roomId] = [];
  rooms[roomId].push(socket.id);

  socket.to(roomId).emit('user-joined', socket.id);

  socket.roomId = roomId;

  // Send existing whiteboard drawings to the newly joined user
  if (whiteboardHistory[roomId]) {
    socket.emit('whiteboard-history', whiteboardHistory[roomId]);
  }

  // Send existing chat history to the newly joined user
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
      }
      console.log('User disconnected:', socket.id);
    });
  });
};

module.exports = setupSignaling;
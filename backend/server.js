require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const roomRoutes = require('./routes/roomRoutes');
const setupSignaling = require('./socket/signaling');
const fileRoutes = require('./routes/fileRoutes');

const app = express();
const server = http.createServer(app);

connectDB();

// Ensure the uploads folder exists (it's gitignored, so it won't exist on a fresh deploy)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

app.use(cors());
app.use(express.json());

// Serve frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/', (req, res) => {
  res.redirect('/login.html');
});

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/files', fileRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000,
});

setupSignaling(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
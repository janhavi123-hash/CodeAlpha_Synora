const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Room = require('../models/Room');
const protect = require('../middleware/auth');

const router = express.Router();

// CREATE ROOM
router.post('/create', protect, async (req, res) => {
  try {
    const roomId = uuidv4().slice(0, 8); // short shareable code
    const room = await Room.create({
      roomId,
      host: req.user.id,
      participants: [req.user.id],
    });
    res.status(201).json({ roomId: room.roomId });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// JOIN ROOM (check it exists before letting frontend redirect there)
router.get('/join/:roomId', protect, async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (!room.participants.includes(req.user.id)) {
      room.participants.push(req.user.id);
      await room.save();
    }

    res.json({ roomId: room.roomId });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
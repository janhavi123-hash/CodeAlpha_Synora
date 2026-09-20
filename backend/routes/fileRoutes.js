const express = require('express');
const multer = require('multer');
const path = require('path');
const protect = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB limit

router.post('/upload', protect, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  res.json({
    fileName: req.file.originalname,
    fileUrl: `/uploads/${req.file.filename}`,
  });
});

module.exports = router;
const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');
document.getElementById('roomTitle').innerText = `Room: ${roomId}`;

const user = JSON.parse(localStorage.getItem('user') || '{}');
const token = localStorage.getItem('token');
const socket = io({ auth: { token } });

let localStream;
let peerConnections = {};
let userStatuses = {}; // { socketId: { name, micOn, camOn } }
let screenStream = null;
let isSharingScreen = false;

// Whiteboard canvas setup (moved up here so it's available before any other code, including reconnect handler, needs it)
const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
let drawing = false, currentColor = '#00ffcc', isErasing = false, lastX = 0, lastY = 0;

const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || !navigator.mediaDevices.getDisplayMedia;
}
if (isMobileDevice()) {
  const shareBtn = document.getElementById('shareScreenBtn');
  if (shareBtn) shareBtn.style.display = 'none';
}

socket.io.on('reconnect', () => {
  Object.keys(peerConnections).forEach((id) => {
    peerConnections[id].close();
    removeTile(id);
  });
  peerConnections = {};

  // Wipe local chat/whiteboard before replaying fresh history — prevents duplicates
  document.getElementById('chatMessages').innerHTML = '';
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (localStream) socket.emit('join-room', roomId);
});

async function init() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

    const startMicOn = sessionStorage.getItem('startMicOn') !== 'false';
    const startCamOn = sessionStorage.getItem('startCamOn') !== 'false';
    localStream.getAudioTracks().forEach((t) => (t.enabled = startMicOn));
    localStream.getVideoTracks().forEach((t) => (t.enabled = startCamOn));

    document.getElementById('localVideo').srcObject = localStream;
    updateLocalTileUI(startMicOn, startCamOn);
    setMicButtonUI(startMicOn);
    setCamButtonUI(startCamOn);

    socket.emit('join-room', roomId);
    broadcastStatus();
  } catch (err) {
    alert('Camera/microphone access is required to join the call.');
    console.error('getUserMedia error:', err);
  }
}

function broadcastStatus() {
  const micOn = localStream.getAudioTracks()[0]?.enabled ?? true;
  const camOn = localStream.getVideoTracks()[0]?.enabled ?? true;
  socket.emit('user-status', { roomId, name: user.name || 'Guest', micOn, camOn: isSharingScreen ? true : camOn });
}

socket.on('user-joined', async (newUserId) => {
  const pc = createPeerConnection(newUserId);
  addLocalTracksToPC(pc);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('offer', { roomId, offer, to: newUserId });

  broadcastStatus(); // let the newcomer know who we are too
});

socket.on('offer', async ({ offer, from }) => {
  const pc = createPeerConnection(from);
  addLocalTracksToPC(pc);

  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('answer', { answer, to: from });

  broadcastStatus();
});

socket.on('answer', async ({ answer, from }) => {
  const pc = peerConnections[from];
  if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', ({ candidate, from }) => {
  const pc = peerConnections[from];
  if (pc) pc.addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on('user-left', (userId) => {
  if (peerConnections[userId]) {
    peerConnections[userId].close();
    delete peerConnections[userId];
  }
  delete userStatuses[userId];
  removeTile(userId);
});

socket.on('user-status', ({ id, name, micOn, camOn }) => {
  userStatuses[id] = { name, micOn, camOn };
  updateRemoteTileUI(id);
});

// New joiners get whichever track (camera or screen) is currently active
function addLocalTracksToPC(pc) {
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) pc.addTrack(audioTrack, localStream);

  const videoTrack = isSharingScreen && screenStream ? screenStream.getVideoTracks()[0] : localStream.getVideoTracks()[0];
  if (videoTrack) pc.addTrack(videoTrack, localStream);
}

function createPeerConnection(userId) {
  const pc = new RTCPeerConnection(iceServers);
  peerConnections[userId] = pc;

  pc.onicecandidate = (event) => {
    if (event.candidate) socket.emit('ice-candidate', { candidate: event.candidate, to: userId });
  };

  pc.ontrack = (event) => {
    ensureTile(userId);
    const videoEl = document.getElementById(`video-${userId}`);
    videoEl.srcObject = event.streams[0];
    updateRemoteTileUI(userId);
  };

  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === 'failed') pc.restartIce();
  };

  return pc;
}

// ===== TILE UI HELPERS =====
function ensureTile(userId) {
  if (document.getElementById(`tile-${userId}`)) return;

  const tile = document.createElement('div');
  tile.className = 'video-tile';
  tile.id = `tile-${userId}`;
  tile.innerHTML = `
    <video id="video-${userId}" autoplay playsinline></video>
    <div class="avatar-overlay" id="avatar-${userId}"></div>
    <div class="tile-label" id="label-${userId}">Guest</div>
  `;
  document.getElementById('videoGrid').appendChild(tile);
}

function updateRemoteTileUI(userId) {
  ensureTile(userId);
  const status = userStatuses[userId] || { name: 'Guest', micOn: true, camOn: true };

  const label = document.getElementById(`label-${userId}`);
  label.innerHTML = status.micOn
    ? status.name
    : `${status.name} <svg class="mic-off-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;

  const video = document.getElementById(`video-${userId}`);
  const avatar = document.getElementById(`avatar-${userId}`);
  avatar.innerText = (status.name || '?').charAt(0).toUpperCase();
  avatar.style.display = status.camOn ? 'none' : 'flex';
  video.style.display = status.camOn ? 'block' : 'none';
}

function updateLocalTileUI(micOn, camOn) {
  const avatar = document.getElementById('avatar-local');
  avatar.innerText = (user.name || '?').charAt(0).toUpperCase();
  avatar.style.display = camOn ? 'none' : 'flex';
  document.getElementById('localVideo').style.display = camOn ? 'block' : 'none';

  const label = document.getElementById('label-local');
  label.innerHTML = micOn
    ? 'You'
    : `You <svg class="mic-off-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
}

function removeTile(userId) {
  const tile = document.getElementById(`tile-${userId}`);
  if (tile) tile.remove();
}

// ===== CONTROLS =====
const MIC_ON_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
const MIC_OFF_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;

const CAM_ON_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;
const CAM_OFF_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16 16v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/><path d="M9.5 5H14a2 2 0 0 1 2 2v3.5"/><polygon points="23 7 16 12 23 17 23 7"/></svg>`;

function setMicButtonUI(on) {
  document.getElementById('muteBtn').innerHTML = on ? MIC_ON_ICON : MIC_OFF_ICON;
}
function setCamButtonUI(on) {
  document.getElementById('videoBtn').innerHTML = on ? CAM_ON_ICON : CAM_OFF_ICON;
}

document.getElementById('muteBtn').onclick = () => {
  const audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
  setMicButtonUI(audioTrack.enabled);
  updateLocalTileUI(audioTrack.enabled, localStream.getVideoTracks()[0]?.enabled);
  broadcastStatus();
};

document.getElementById('videoBtn').onclick = () => {
  const videoTrack = localStream.getVideoTracks()[0];
  videoTrack.enabled = !videoTrack.enabled;
  setCamButtonUI(videoTrack.enabled);
  updateLocalTileUI(localStream.getAudioTracks()[0]?.enabled, videoTrack.enabled);
  broadcastStatus();
};

document.getElementById('shareScreenBtn').onclick = async () => {
  if (!isSharingScreen) {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];

      Object.values(peerConnections).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);
      });

      document.getElementById('localVideo').srcObject = screenStream;
      isSharingScreen = true;
      updateLocalTileUI(localStream.getAudioTracks()[0]?.enabled, true);
      broadcastStatus();

      screenTrack.onended = () => stopScreenShare();
    } catch (err) {
      console.error('Screen share error:', err);
    }
  } else {
    stopScreenShare();
  }
};

function stopScreenShare() {
  if (screenStream) screenStream.getTracks().forEach((t) => t.stop());

  const cameraTrack = localStream.getVideoTracks()[0];
  Object.values(peerConnections).forEach((pc) => {
    const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (sender) sender.replaceTrack(cameraTrack);
  });

  document.getElementById('localVideo').srcObject = localStream;
  isSharingScreen = false;
  updateLocalTileUI(localStream.getAudioTracks()[0]?.enabled, cameraTrack.enabled);
  broadcastStatus();
}

document.getElementById('endCallBtn').onclick = () => {
  if (localStream) localStream.getTracks().forEach((t) => t.stop());
  if (screenStream) screenStream.getTracks().forEach((t) => t.stop());
  Object.values(peerConnections).forEach((pc) => pc.close());
  socket.disconnect();
  window.location.href = 'dashboard.html';
};

// ===== CHAT =====
document.getElementById('sendChatBtn').onclick = () => {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;
  socket.emit('chat-message', { roomId, message });
  appendChatMessage('You', message);
  input.value = '';
};
socket.on('chat-message', ({ message, from }) => appendChatMessage(from, message));
socket.on('chat-history', (history) => history.forEach(({ message, from }) => appendChatMessage(from, message)));

function appendChatMessage(sender, message) {
  const chatBox = document.getElementById('chatMessages');
  const msgEl = document.createElement('div');
  msgEl.style.marginBottom = '6px';
  msgEl.innerHTML = `<strong>${sender}:</strong> ${message}`;
  chatBox.appendChild(msgEl);
  chatBox.scrollTop = chatBox.scrollHeight;
}

document.getElementById('sendFileBtn').onclick = async () => {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];
  if (!file) return alert('Choose a file first');

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/files/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();

    if (res.ok) {
      const fileMessage = `📎 <a href="${data.fileUrl}" target="_blank" rel="noopener noreferrer" style="color:#4ea1ff;">${data.fileName}</a>`;
      socket.emit('chat-message', { roomId, message: fileMessage });
      appendChatMessage('You', fileMessage);
      fileInput.value = '';
    } else {
      alert(data.message || 'Upload failed');
    }
  } catch (err) {
    console.error('File upload error:', err);
    alert('File upload failed');
  }
};

// ===== WHITEBOARD =====
document.getElementById('penColor').addEventListener('input', (e) => { currentColor = e.target.value; isErasing = false; });
document.getElementById('eraserBtn').addEventListener('click', () => {
  isErasing = !isErasing;
  document.getElementById('eraserBtn').innerText = isErasing ? 'Pen' : 'Eraser';
});
document.getElementById('clearBoardBtn').addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  socket.emit('whiteboard-clear', { roomId });
});

function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

function startDraw(e) { drawing = true; const { x, y } = getCanvasCoords(e); lastX = x; lastY = y; }
function draw(e) {
  if (!drawing) return;
  e.preventDefault();
  const { x, y } = getCanvasCoords(e);
  const color = isErasing ? '#ffffff' : currentColor;
  const width = isErasing ? 16 : 3;
  drawLine(lastX, lastY, x, y, color, width);
  socket.emit('whiteboard-draw', { roomId, fromX: lastX, fromY: lastY, toX: x, toY: y, color, width });
  lastX = x; lastY = y;
}
function stopDraw() { drawing = false; }
function drawLine(fromX, fromY, toX, toY, color, width) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(fromX, fromY); ctx.lineTo(toX, toY); ctx.stroke();
}

canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDraw);
canvas.addEventListener('mouseleave', stopDraw);
canvas.addEventListener('touchstart', startDraw);
canvas.addEventListener('touchmove', draw);
canvas.addEventListener('touchend', stopDraw);

socket.on('whiteboard-draw', ({ fromX, fromY, toX, toY, color, width }) => drawLine(fromX, fromY, toX, toY, color, width));
socket.on('whiteboard-clear', () => ctx.clearRect(0, 0, canvas.width, canvas.height));
socket.on('whiteboard-history', (history) => history.forEach(({ fromX, fromY, toX, toY, color, width }) => drawLine(fromX, fromY, toX, toY, color, width)));

init();
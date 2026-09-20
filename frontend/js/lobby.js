const params = new URLSearchParams(window.location.search);
const roomId = params.get('roomId');
document.getElementById('roomLabel').innerText = `Room: ${roomId}`;

const user = JSON.parse(localStorage.getItem('user') || '{}');

let previewStream;
let micOn = true;
let camOn = true;

async function startPreview() {
  try {
    previewStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('previewVideo').srcObject = previewStream;
  } catch (err) {
    alert('Camera/microphone access is required to join.');
  }
}

document.getElementById('micToggle').onclick = () => {
  micOn = !micOn;
  if (previewStream) previewStream.getAudioTracks().forEach((t) => (t.enabled = micOn));
  document.getElementById('micToggle').classList.toggle('off', !micOn);
};

document.getElementById('camToggle').onclick = () => {
  camOn = !camOn;
  if (previewStream) previewStream.getVideoTracks().forEach((t) => (t.enabled = camOn));
  document.getElementById('camToggle').classList.toggle('off', !camOn);

  const overlay = document.getElementById('avatarOverlay');
  overlay.style.display = camOn ? 'none' : 'flex';
  overlay.innerText = (user.name || '?').charAt(0).toUpperCase();
  document.getElementById('previewVideo').style.display = camOn ? 'block' : 'none';
};

document.getElementById('joinBtn').onclick = () => {
  if (previewStream) previewStream.getTracks().forEach((t) => t.stop());
  sessionStorage.setItem('startMicOn', micOn);
  sessionStorage.setItem('startCamOn', camOn);
  window.location.href = `room.html?roomId=${roomId}`;
};

startPreview();
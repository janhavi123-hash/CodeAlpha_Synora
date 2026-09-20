const ROOM_API = '/api/rooms';
const token = localStorage.getItem('token');

if (!token) window.location.href = 'login.html'; // block access if not logged in

async function createRoom() {
  const res = await fetch(`${ROOM_API}/create`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await res.json();

  if (res.ok) {
    window.location.href = `lobby.html?roomId=${data.roomId}`;
  } else {
    document.getElementById('error').innerText = data.message;
  }
}

async function joinRoom() {
  const roomId = document.getElementById('joinRoomId').value.trim();
  const res = await fetch(`${ROOM_API}/join/${roomId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await res.json();

  if (res.ok) {
    window.location.href = `lobby.html?roomId=${data.roomId}`;
  } else {
    document.getElementById('error').innerText = data.message;
  }
}
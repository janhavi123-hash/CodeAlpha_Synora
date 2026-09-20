const API_BASE = '/api/auth';

async function registerUser() {
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    document.getElementById('error').innerText = 'Please enter a valid email address';
    return;
  }

  const res = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();

  if (res.ok) {
    window.location.href = 'login.html';
  } else {
    document.getElementById('error').innerText = data.message;
  }
}

async function loginUser() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();

  if (res.ok) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    window.location.href = 'dashboard.html';
  } else {
    document.getElementById('error').innerText = data.message;
  }
}

async function sendResetCode() {
  const email = document.getElementById('email').value;

  const res = await fetch(`${API_BASE}/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();

  if (res.ok) {
    sessionStorage.setItem('resetEmail', email); // carry email to next page
    window.location.href = 'reset-password.html';
  } else {
    document.getElementById('error').innerText = data.message;
  }
}

async function resetPassword() {
  const email = sessionStorage.getItem('resetEmail');
  const otp = document.getElementById('otp').value;
  const newPassword = document.getElementById('newPassword').value;

  if (!email) {
    document.getElementById('error').innerText = 'Session expired, please start again';
    return;
  }

  const res = await fetch(`${API_BASE}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp, newPassword }),
  });
  const data = await res.json();

  if (res.ok) {
    sessionStorage.removeItem('resetEmail');
    alert('Password reset successful. Please log in.');
    window.location.href = 'login.html';
  } else {
    document.getElementById('error').innerText = data.message;
  }
}

function togglePassword(inputId, iconEl) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    iconEl.innerHTML = '&#128064;'; // slightly different eye style when shown, optional
  } else {
    input.type = 'password';
    iconEl.innerHTML = '&#128065;';
  }
}
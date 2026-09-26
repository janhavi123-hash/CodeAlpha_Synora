# Synora — Real-Time Video Conferencing & Collaboration App

Synora is a full-stack, real-time video conferencing application built as a Zoom/Google Meet-style tool. It supports multi-user video calls, screen sharing, live chat, file sharing, and a collaborative whiteboard — all built from scratch using WebRTC, Socket.io, and the MERN-adjacent stack (Node.js/Express/MongoDB).

**Live demo:** https://synora-ndns.onrender.com

> Note: hosted on Render's free tier, which sleeps after 15 minutes of inactivity. The first request after idle time may take 30–50 seconds to wake up.

## 🎥 Demo Video
[Click here to watch the demo](https://drive.google.com/file/d/1YwjjEzHsHa9cHOAf18GZmfrR2ZjWMusn/view?usp=drivesdk)

---

## Features

- **Authentication** — Registration, login, and password reset via emailed OTP codes. Passwords hashed with bcrypt; sessions secured with JWT.
- **Multi-user video calling** — Real-time video/audio calling between any number of participants using WebRTC (mesh peer-to-peer topology).
- **Screen sharing** — Any desktop participant can share their screen; the shared stream replaces the outgoing camera track live.
- **Live chat** — Real-time text messaging within a room, with message history so users rejoining mid-call see the full conversation.
- **File sharing** — Upload and share files during a call; download links appear directly in the chat panel.
- **Collaborative whiteboard** — Multiple participants can draw on a shared canvas simultaneously, with full history sync for late joiners.
- **Participant tiles** — Show name, a colored avatar with initial when camera is off, and a muted-mic icon.
- **Authenticated real-time layer** — Socket.io connections require a valid JWT, so only logged-in users can join rooms, chat, or draw.

---

## Tech Stack

**Frontend:** HTML, CSS, vanilla JavaScript
**Backend:** Node.js, Express, Socket.io
**Database:** MongoDB Atlas (Mongoose)
**Real-time communication:** WebRTC (media) + Socket.io (signaling)
**Auth:** JWT, bcrypt
**Email:** Brevo Transactional Email API for OTP-based password reset
**File uploads:** Multer
**Hosting:** Render

---

## Architecture Overview

Synora uses three cooperating layers:

1. **Signaling server (Socket.io)** — carries no video/audio; it only relays WebRTC offers, answers, and ICE candidates so browsers can find each other.
2. **WebRTC peer connections** — once signaling completes, audio/video/screen-share flows directly between browsers, encrypted by default via DTLS-SRTP.
3. **STUN + TURN** — STUN helps peers discover their network address; a TURN server (Open Relay Project) relays traffic when a direct connection isn't possible due to NAT/firewall restrictions — required for reliable calls with 3+ participants across different networks.

Video calling uses a **mesh topology** (every participant connects directly to every other). This works well for small groups (tested with 3 participants across different devices/networks) but doesn't scale efficiently beyond that — a production system would use an SFU media server instead. This is an intentional, known scope decision.

Chat and whiteboard events are relayed through the same signaling server and kept in server memory per room, so participants who join mid-session or reconnect after a dropped connection receive full history automatically.

Password-reset emails are sent via **Brevo's transactional email API** (HTTPS-based) rather than direct SMTP. This was a deliberate fix: Render's free tier blocks outbound SMTP ports (465/587) as an anti-spam measure, which caused email delivery to hang and time out when using Gmail's SMTP directly. Switching to an HTTP-based email API resolved this, since HTTPS traffic (port 443) is never blocked on cloud hosting platforms.

---

## Project Structure

```
synora/
├── backend/
│ ├── server.js
│ ├── config/db.js
│ ├── models/ (User.js, Room.js)
│ ├── middleware/auth.js
│ ├── routes/ (authRoutes.js, roomRoutes.js, fileRoutes.js)
│ ├── socket/signaling.js
│ ├── utils/sendEmail.js
│ └── uploads/ (gitignored)
└── frontend/
├── login.html, register.html, forgot-password.html, reset-password.html
├── dashboard.html, lobby.html, room.html
├── css/style.css
└── js/ (auth.js, dashboard.js, lobby.js, room.js)
```

## Known Limitations & Trade-offs

- **Mesh topology** doesn't scale to large calls — an SFU media server would be needed beyond ~6–8 participants.
- **Screen sharing is desktop-only** — most mobile browsers don't reliably support `getDisplayMedia`.
- **Free-tier TURN server** — has bandwidth limits; a production app would use a dedicated TURN provider.
- **File uploads use local disk storage**, which is ephemeral on Render's free tier — files are wiped on redeploy/restart. Production would use cloud storage (e.g., S3, Cloudinary).
- **Outbound SMTP ports are blocked on Render's free tier** — resolved by using Brevo's HTTPS-based transactional email API instead of direct SMTP.
- **Free-tier hosting** — cold-start delay after inactivity.

---

## Security Notes

- Passwords hashed with bcrypt, never stored in plain text.
- All room-related REST endpoints require a valid JWT.
- Socket.io connections are authenticated via JWT middleware.
- WebRTC media is encrypted end-to-end by default (DTLS-SRTP).

---

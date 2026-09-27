# Mukaputa — Full-Stack Social Media App

Your original project was a **frontend-only** demo: every "feature" (posts,
comments, reactions, stories, reels, messaging, jobs, pages, friends,
notifications) lived entirely in the browser's `localStorage`, and login,
calling, and voice notes were all faked with no real functionality behind
them.

This package adds a **real Python backend** (Flask + SQLAlchemy/SQLite,
plus a WebSocket layer for calling) and rewires the existing frontend to
talk to it, so the whole app is now a genuine multi-user product:

- Real accounts with hashed passwords and session-based login
- A real database — posts, comments, reactions, stories, reels, messages,
  jobs, pages, friends, and notifications all persist across restarts and
  are shared correctly between different logged-in users
- Real image/video uploads (avatars, covers, post photos, story photos,
  chat images, reels) saved to disk instead of being crammed into
  `localStorage` as text
- **Real voice notes** — actual microphone recording (via `MediaRecorder`),
  uploaded and played back as real audio, not a fake animated waveform
- **Real voice & video calling** — genuine WebRTC calls signaled over a
  live WebSocket connection: calling a friend actually rings on their
  screen in real time, and they can accept or decline for real, with a
  real live video/audio feed once connected
- **Reel uploads** — a working "+" button to select a video and post it as
  a reel, which didn't exist before
- Real notifications, generated server-side whenever someone reacts,
  comments, follows, friends, calls, or messages you
- Light polling so notifications and open chats update without a full page
  reload
- A tightened-up, mobile-friendly chat layout

## 1. Requirements

- Python 3.9+
- A modern browser (Chrome, Edge, Firefox, or Safari) for the microphone/
  camera APIs used by calling and voice notes

## 2. Setup

```bash
cd mukaputa
pip install -r requirements.txt
python run.py
```

Then open **http://localhost:5000** in your browser. That's it — the
database (`mukaputa.db`) and an `uploads/` folder are created automatically
on first run, and the app comes pre-populated with demo content so it
doesn't feel empty.

> **Important:** browsers only allow microphone/camera access (needed for
> calls and voice notes) on `localhost` or over HTTPS. Running the app at
> `http://localhost:5000` on your own machine works out of the box. If you
> deploy this to a real server for others to use, put it behind HTTPS or
> calling/voice notes won't be able to request mic/camera permission.

## 3. Try it out

**Demo accounts** (all use the password `password123`):

| Username    | Name             |
|-------------|------------------|
| `johndoe`   | John Doe         |
| `janesmith` | Jane Smith       |
| `mikej`     | Michael Johnson  |
| `sarahc`    | Sarah Connor     |
| `alext`     | Alex Turing      |
| `priyap`    | Priya Patel      |
| `davidk`    | David Kim        |

Or just click "Create one" on the login screen to register your own new
account — it will show up to the demo accounts as a real person (with
posts, friend requests, and messages all working two-way).

**To see messaging, notifications, and calling working live**, log in as
two different accounts in two separate browser windows (e.g. one normal
window + one incognito window, or two different browsers) and message,
react, friend, or call between them. When Account A calls Account B,
Account B will see a real incoming-call screen ring live, with working
Accept/Decline.

## 4. Project layout

```
mukaputa/
├── run.py                 # Entry point -- `python run.py` starts everything
├── requirements.txt
├── backend/
│   ├── app.py              # Flask app factory, static file serving
│   ├── config.py           # Settings (secret key, upload limits, DB path)
│   ├── extensions.py       # SQLAlchemy / Flask-Login / Socket.IO instances
│   ├── models.py           # All database tables
│   ├── seed.py             # Populates demo data on first run
│   ├── sockets.py          # Real-time WebSocket signaling for calls
│   ├── utils.py            # Small shared helpers (uploads, notifications)
│   └── routes/
│       ├── auth.py          # register / login / logout / password / delete
│       ├── bootstrap.py     # GET /api/bootstrap -- the full app snapshot
│       ├── posts.py         # posts, comments, replies, reactions
│       ├── social.py        # profile, friends, follow, block, save
│       ├── content.py       # stories, reels
│       ├── jobs.py          # job vacancies + applications
│       ├── pages.py         # pages + follow
│       ├── messaging.py     # conversations + messages
│       ├── notifications.py
│       └── uploads.py       # POST /api/upload
├── frontend/                # Your original UI, updated to call the API
│   ├── index.html
│   ├── login.html            # now does real register/login
│   ├── landing_page.html
│   ├── css/
│   │   └── realtime.css        # calls, voice notes, reel FAB, mobile chat
│   └── js/
│       ├── store.js           # rewritten: syncs with the backend instead of localStorage
│       ├── boot.js             # new: loads your session + data, then starts the app
│       ├── login.js            # rewritten: real auth calls
│       ├── calls.js            # new: real WebRTC voice/video calling
│       └── app.js, feed.js, components.js  # your original UI logic, patched
└── uploads/                  # user-uploaded images/video/audio (auto-created)
```

## 5. How calling actually works

Calling uses [WebRTC](https://webrtc.org/): once two people agree to a
call, their browsers open a **direct peer-to-peer connection** to each
other and audio/video flows straight between them — the server never
sees or touches the actual call media.

What the server *does* do is called "signaling" — it's the part that gets
two browsers introduced to each other over a live WebSocket connection
(`backend/sockets.py` + `frontend/js/calls.js`):

1. You click call → your browser asks the server to ring the other person
2. If they're online, they get a real "Incoming call" screen instantly
3. If they accept, the two browsers exchange connection details through
   the server (this is the only part that touches the server)
4. From then on, audio/video streams directly between the two browsers

This uses public Google STUN servers to help browsers behind home/office
routers find each other. It does **not** include a TURN relay server,
which some very restrictive networks (strict corporate firewalls, certain
mobile carriers) need in order to connect. If a call won't connect between
two specific networks, that's most likely why — running your own TURN
server (e.g. [coturn](https://github.com/coturn/coturn)) and adding it to
the `ICE_SERVERS` list in `frontend/js/calls.js` would resolve it, but that
requires separate server infrastructure beyond what's included here.

## 6. What was changed, and why

- **`store.js`** used to be a thin wrapper around `localStorage`. It's been
  rewritten so every method keeps the exact same name/behavior the rest of
  the app already expects, but now reads from a snapshot fetched from the
  backend and writes back to it via `fetch()` calls, instead of writing to
  `localStorage`.
- **`login.html` / `login.js`** previously had no real logic at all —
  "logging in" just redirected after a fake delay, and "registering" just
  showed an alert. These now call the real `/api/auth/*` endpoints.
- **Image/video uploads** (post photos, story photos, avatar/cover, chat
  images, reels) previously read files as base64 and stored the resulting
  (very large) text directly in `localStorage`. They now upload to
  `/api/upload` and store a normal file URL instead.
- **Voice notes** used to fake a random-length recording and play back a
  purely decorative animated waveform with no real audio behind it at all.
  They now use the browser's real microphone (`MediaRecorder`), upload the
  actual recording, and play it back with a real seekable audio player.
- **Calling** used to show a "Calling..." popup that didn't contact
  anyone — there was no way for it to ever ring on the other person's
  screen. It's now backed by real WebRTC + live WebSocket signaling (see
  section 5), so calls actually reach and ring the other person, who can
  genuinely accept or decline.
- **Reels** had no upload feature in the original UI at all — reels could
  only be viewed, liked, and commented on. A working upload button/modal
  and backend endpoint were added.
- **Chat** used to fake a canned auto-reply ("That sounds great! 😄") a few
  seconds after every message, pretending to be the other person. That's
  been removed — messages are real now, so replies come from whoever you're
  actually talking to.
- **Notifications** are now created automatically by the backend whenever
  something notification-worthy happens (a reaction, a comment, a new
  friend, a follow, a message), rather than only existing as one-off seed
  data.
- **Mobile chat layout** was tightened up so the conversation list and an
  open thread never show squeezed together — the app now shows exactly one
  pane at a time below tablet width, with bubbles, inputs, and voice-note
  players sized to fit small screens.
- **Groups and Events**: these were already dead code in the frontend you
  provided — there's no visible page/section wired up for them anywhere in
  the UI (no `groups-view`/`events-view` sections exist, and no button ever
  opens them), so no backend was built for them. Nothing was removed —
  they simply weren't reachable before either.
- A couple of small pre-existing bugs were fixed along the way: "Create
  Page" called a store method that didn't exist (`store.addPage`) and would
  have crashed; the password-change and blocked-accounts screens used fake
  placeholder data instead of doing anything real.

## 7. Notes for going to production

This is set up for local use / demos out of the box. Before deploying it
publicly you'd want to, at minimum:
- Set a real `MUKAPUTA_SECRET_KEY` environment variable (a long random
  string) instead of the built-in development default
- Run it behind a production-grade server for both HTTP and WebSocket
  traffic (e.g. gunicorn with an eventlet/gevent worker, or a reverse proxy
  that supports WebSocket upgrades) instead of the Flask dev server, and
  turn `MUKAPUTA_DEBUG` off
- Put it behind HTTPS (also required for microphone/camera permissions on
  a real domain)
- Add a TURN server if you need calls to work reliably across very
  restrictive networks (see section 5)
- Consider swapping SQLite for Postgres if you expect meaningful concurrent
  traffic

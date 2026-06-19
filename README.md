# Song Duel

<img src="client/public/logo.png" width="120" alt="Song Duel logo" />

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen?logo=node.js)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socket.io&logoColor=white)](https://socket.io)

A real-time multiplayer music guessing game. Players listen to 30-second song previews and race to guess the title, artist, and/or release year in a shared chat. Powered by the Deezer public API.

## Features

- **Lobby system** — create or join rooms with a 6-character code, shareable via invite link
- **Playlist picker** — search Deezer playlists or browse by genre; add multiple playlists per game
- **Configurable rounds** — host sets song count (5–25), round duration (5–30s), and what to guess (title / artist / year)
- **Fuzzy matching** — guesses are validated with Levenshtein distance, stripping features, remixes, and punctuation variants
- **Time-decay scoring** — full points for an instant guess, 50% if you answer at the very end of the round
- **Live chat** — guessing and chatting share the same input; correct guesses are highlighted in the feed
- **Song reveal** — album art, title, artists, and year are revealed after each round along with a per-round scoreboard

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, TypeScript, Vite, React Router v6 |
| Backend | Node.js, Express, Socket.IO |
| Realtime | Socket.IO (client ↔ server) |
| Music data | [Deezer public API](https://developers.deezer.com/api) |
| Shared types | TypeScript (`/shared/types.ts`) |

## Getting started

### Prerequisites

- Node.js 18+

### Install dependencies

```bash
npm run install:all
```

### Run in development

Open two terminals:

```bash
# Terminal 1 — API + Socket.IO server (port 3001)
npm run dev:server

# Terminal 2 — Vite dev server (port 5173)
npm run dev:client
```

The Vite dev server proxies `/api` and `/socket.io` to `localhost:3001`, so everything runs from `http://localhost:5173`.

### Build and run in production

```bash
npm run build   # builds the React app into client/dist/
npm start       # serves client + API from a single Express process
```

The server serves the Vite build as static files with an SPA fallback. Default port is `3001`; set `PORT` to override.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Port the server listens on |
| `CLIENT_URL` | `http://localhost:5173` | Allowed CORS origin in development |
| `NODE_ENV` | — | Set to `production` to disable CORS and serve the client build |

No Deezer credentials are needed — the API used is fully public.

## Project structure

```
song-duel/
├── client/                 # React + Vite frontend
│   └── src/
│       ├── pages/          # Home, Lobby, Game
│       ├── components/     # Chat, Scoreboard, Logo
│       ├── context/        # GameContext (username persistence)
│       └── socket.ts       # Socket.IO client + persistent player ID
├── server/                 # Express + Socket.IO backend
│   └── src/
│       ├── routes/         # REST: /api/lobby, /api/deezer
│       ├── services/       # deezer.ts (API), gameEngine.ts (scoring/matching)
│       ├── socket/         # Socket event handlers
│       ├── state/          # In-memory lobby store
│       └── game/           # Game loop (song sequencing, timers)
└── shared/
    └── types.ts            # Types shared between client and server
```

## License

[MIT](LICENSE)
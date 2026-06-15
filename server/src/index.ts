import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import lobbyRoutes from './routes/lobby';
import spotifyRoutes from './routes/spotify';
import { setupSocketHandlers } from './socket';

const app = express();
const httpServer = createServer(app);
const isProd = process.env.NODE_ENV === 'production';

// In production client and server share the same origin — no CORS needed.
// In development the Vite dev server proxies /api and /socket.io to us.
const devOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
const io = new Server(httpServer, {
  cors: isProd ? undefined : { origin: devOrigin },
});

if (!isProd) {
  app.use(cors({ origin: devOrigin }));
}

app.use(express.json());

app.use('/api/lobby', lobbyRoutes);
app.use('/api/spotify', spotifyRoutes);

setupSocketHandlers(io);

// Serve the Vite build in production, with SPA fallback
if (isProd) {
  // __filename / __dirname aren't available in ESM; this file is CommonJS so they are fine.
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

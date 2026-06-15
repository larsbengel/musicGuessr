import { Router } from 'express';
import { createLobby, getLobby, lobbyToInfo } from '../state/lobbyStore';

const router = Router();

router.post('/', (_req, res) => {
  const code = createLobby();
  res.json({ code });
});

router.get('/:code', (req, res) => {
  const lobby = getLobby(req.params.code.toUpperCase());
  if (!lobby) {
    res.status(404).json({ error: 'Lobby not found' });
    return;
  }
  res.json(lobbyToInfo(lobby));
});

export default router;

import { Router } from 'express';
import { searchPlaylists } from '../services/spotify';

const router = Router();

router.get('/search', async (req, res) => {
  const query = req.query.q as string;
  if (!query?.trim()) {
    res.status(400).json({ error: 'Query is required' });
    return;
  }
  try {
    const playlists = await searchPlaylists(query.trim());
    res.json({ playlists });
  } catch (err) {
    console.error('Spotify search error:', err);
    res.status(500).json({ error: 'Spotify search failed' });
  }
});

export default router;

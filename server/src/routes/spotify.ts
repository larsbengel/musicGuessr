import { Router } from 'express';
import { searchPlaylists, getFeaturedPlaylists, getGenrePlaylists } from '../services/spotify';

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
    res.status(500).json({ error: 'Search failed' });
  }
});

router.get('/featured', async (_req, res) => {
  try {
    const playlists = await getFeaturedPlaylists();
    res.json({ playlists });
  } catch (err) {
    console.error('Spotify featured playlists error:', err);
    res.status(500).json({ error: 'Could not load featured playlists' });
  }
});

router.get('/genre/:name/playlists', async (req, res) => {
  const { name } = req.params;
  try {
    const playlists = await getGenrePlaylists(name);
    res.json({ playlists });
  } catch (err) {
    console.error('Spotify genre playlists error:', err);
    res.status(500).json({ error: 'Could not load genre playlists' });
  }
});

export default router;

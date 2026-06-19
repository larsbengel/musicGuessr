import { Router } from 'express';
import { searchPlaylists, getFeaturedPlaylists, getGenres, getGenrePlaylists } from '../services/deezer';

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
    console.error('Deezer search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

router.get('/featured', async (_req, res) => {
  try {
    const playlists = await getFeaturedPlaylists();
    res.json({ playlists });
  } catch (err) {
    console.error('Featured playlists error:', err);
    res.status(500).json({ error: 'Could not load featured playlists' });
  }
});

router.get('/genres', async (_req, res) => {
  try {
    const genres = await getGenres();
    res.json({ genres });
  } catch (err) {
    console.error('Genres error:', err);
    res.status(500).json({ error: 'Could not load genres' });
  }
});

router.get('/genre/:id/playlists', async (req, res) => {
  const name = req.query.name as string;
  if (!name?.trim()) {
    res.status(400).json({ error: 'Genre name is required' });
    return;
  }
  try {
    const playlists = await getGenrePlaylists(name.trim());
    res.json({ playlists });
  } catch (err) {
    console.error('Genre playlists error:', err);
    res.status(500).json({ error: 'Could not load genre playlists' });
  }
});

export default router;

import axios, { AxiosResponse } from 'axios';
import { Song, SpotifyPlaylist } from '../../../shared/types';

// Deezer public API — no auth required, all tracks have 30s previews
const deezer = axios.create({
  baseURL: 'https://api.deezer.com',
  headers: { 'Accept-Language': 'en' },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPlaylist(p: any): SpotifyPlaylist {
  return {
    id: String(p.id),
    name: (p.title ?? p.name) as string,
    imageUrl: (p.picture_medium ?? p.picture ?? null) as string | null,
    trackCount: (p.nb_tracks ?? 0) as number,
    owner: (p.user?.name ?? p.creator?.name ?? 'Unknown') as string,
  };
}

export async function searchPlaylists(query: string, limit = 12): Promise<SpotifyPlaylist[]> {
  const response = await deezer.get('/search/playlist', { params: { q: query, limit } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (response.data.data as any[]).map(mapPlaylist);
}

export async function getFeaturedPlaylists(): Promise<SpotifyPlaylist[]> {
  // Use search instead of regional chart — chart returns country-specific (IP-based) content
  const response = await deezer.get('/search/playlist', {
    params: { q: 'top hits', limit: 20, order: 'RANKING' },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (response.data.data as any[]).map(mapPlaylist);
}

export interface DeezerGenre {
  id: number;
  name: string;
  imageUrl: string | null;
}

export async function getGenres(): Promise<DeezerGenre[]> {
  const response = await deezer.get('/genre');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (response.data.data as any[])
    .filter((g) => g.id !== 0)
    .map((g) => ({ id: g.id as number, name: g.name as string, imageUrl: (g.picture_medium ?? null) as string | null }));
}

export async function getGenrePlaylists(genreName: string): Promise<SpotifyPlaylist[]> {
  // Search by genre name so results are global rather than regional
  const response = await deezer.get('/search/playlist', {
    params: { q: genreName, limit: 20, order: 'RANKING' },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (response.data.data as any[]).map(mapPlaylist);
}

export async function getPlaylistTracks(playlistId: string, fetchYears = false): Promise<Song[]> {
  type RawTrack = { id: string; title: string; artist: string; albumId: string; albumArt: string | null; previewUrl: string };
  const rawTracks: RawTrack[] = [];
  let url: string | null = '/playlist/' + playlistId + '/tracks?limit=100';

  while (url) {
    const response: AxiosResponse = await deezer.get(url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const track of response.data.data as any[]) {
      if (!track.preview) continue;
      rawTracks.push({
        id: String(track.id),
        title: track.title as string,
        artist: track.artist.name as string,
        albumId: String(track.album.id),
        albumArt: (track.album?.cover_medium as string) ?? null,
        previewUrl: track.preview as string,
      });
    }
    url = (response.data.next as string) || null;
    if (rawTracks.length >= 200) break;
  }

  // Fetch album release years in batches (release_date is not in the playlist tracks response)
  const albumYears = new Map<string, number>();
  if (fetchYears) {
    const uniqueAlbumIds = [...new Set(rawTracks.map((r) => r.albumId))];
    const BATCH = 10;
    for (let i = 0; i < uniqueAlbumIds.length; i += BATCH) {
      await Promise.all(
        uniqueAlbumIds.slice(i, i + BATCH).map(async (albumId) => {
          try {
            const resp = await deezer.get(`/album/${albumId}`);
            const year = parseInt((resp.data.release_date as string)?.substring(0, 4), 10);
            if (!isNaN(year)) albumYears.set(albumId, year);
          } catch { /* skip — year stays undefined for this album */ }
        })
      );
    }
  }

  return rawTracks.map((r) => ({
    id: r.id,
    title: r.title,
    artists: [r.artist],
    albumArt: r.albumArt,
    previewUrl: r.previewUrl,
    year: albumYears.get(r.albumId),
  }));
}

import axios from 'axios';
import { SpotifyPlaylist } from '../../../shared/types';

export interface SpotifyTrackInfo {
  spotifyId: string;
  title: string;
  artists: string[];
  isrc: string | null;
  year?: number;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials not configured (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET)');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await axios.post(
    'https://accounts.spotify.com/api/token',
    'grant_type=client_credentials',
    { headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  tokenCache = {
    accessToken: response.data.access_token as string,
    expiresAt: Date.now() + (response.data.expires_in as number) * 1000,
  };
  return tokenCache.accessToken;
}

const MIN_TRACK_COUNT = 10;
const MARKET = process.env.SPOTIFY_MARKET || 'US';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPlaylist(p: any): SpotifyPlaylist {
  return {
    id: p.id as string,
    name: p.name as string,
    imageUrl: (p.images?.[0]?.url ?? null) as string | null,
    trackCount: (p.tracks?.total ?? 0) as number,
    owner: (p.owner?.display_name ?? 'Unknown') as string,
    source: 'spotify',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filterPlaylists(items: any[]): SpotifyPlaylist[] {
  return items.filter(Boolean).map(mapPlaylist).filter((p) => p.trackCount >= MIN_TRACK_COUNT);
}

export async function searchPlaylists(query: string, limit = 12): Promise<SpotifyPlaylist[]> {
  const token = await getAccessToken();
  // Fetch extra to account for items filtered out by MIN_TRACK_COUNT
  const response = await axios.get('https://api.spotify.com/v1/search', {
    headers: { Authorization: `Bearer ${token}` },
    params: { q: query, type: 'playlist', limit: Math.min(limit * 2, 50), market: MARKET },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return filterPlaylists(response.data.playlists?.items as any[]).slice(0, limit);
}

export async function getFeaturedPlaylists(): Promise<SpotifyPlaylist[]> {
  const token = await getAccessToken();
  const queries = ['top hits', 'greatest hits', 'rock classics', 'hip hop essentials', 'pop party'];
  const headers = { Authorization: `Bearer ${token}` };
  const results = await Promise.all(
    queries.map((q) =>
      axios
        .get('https://api.spotify.com/v1/search', {
          headers,
          params: { q, type: 'playlist', limit: 6, market: MARKET },
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((r) => filterPlaylists(r.data.playlists?.items as any[]))
    )
  );
  const seen = new Set<string>();
  return results.flat().filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

export async function getGenrePlaylists(genre: string): Promise<SpotifyPlaylist[]> {
  const token = await getAccessToken();
  const response = await axios.get('https://api.spotify.com/v1/search', {
    headers: { Authorization: `Bearer ${token}` },
    params: { q: `${genre} playlist`, type: 'playlist', limit: 24, market: MARKET },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return filterPlaylists(response.data.playlists?.items as any[]);
}

export async function getPlaylistTracks(playlistId: string): Promise<SpotifyTrackInfo[]> {
  const token = await getAccessToken();
  const tracks: SpotifyTrackInfo[] = [];
  const fields = 'next,items(track(id,name,artists(name),external_ids(isrc),album(release_date)))';
  let url: string | null =
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=${encodeURIComponent(fields)}`;

  while (url && tracks.length < 200) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data }: { data: any } = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of data.items as any[]) {
      const t = item?.track;
      if (!t || t.type === 'episode') continue;
      const rawYear = (t.album?.release_date as string | undefined)?.substring(0, 4);
      const year = rawYear ? parseInt(rawYear, 10) : undefined;
      tracks.push({
        spotifyId: t.id as string,
        title: t.name as string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        artists: (t.artists as any[]).map((a) => a.name as string),
        isrc: (t.external_ids?.isrc as string | undefined) ?? null,
        year: year && !isNaN(year) ? year : undefined,
      });
    }
    url = (data.next as string | null) ?? null;
  }

  return tracks;
}

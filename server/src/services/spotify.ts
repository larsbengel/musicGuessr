import axios, { AxiosResponse } from 'axios';
import { Song, SpotifyPlaylist } from '../../../shared/types';

// Deezer public API — no auth required, all tracks have 30s previews
const API = 'https://api.deezer.com';

export async function searchPlaylists(query: string, limit = 12): Promise<SpotifyPlaylist[]> {
  const response = await axios.get(`${API}/search/playlist`, {
    params: { q: query, limit },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (response.data.data as any[]).map((p) => ({
    id: String(p.id),
    name: p.title as string,
    imageUrl: (p.picture_medium as string) ?? null,
    trackCount: (p.nb_tracks as number) ?? 0,
    owner: (p.creator?.name as string) ?? 'Unknown',
  }));
}

export async function getPlaylistTracks(playlistId: string): Promise<Song[]> {
  const songs: Song[] = [];
  let url: string | null = `${API}/playlist/${playlistId}/tracks?limit=100`;

  while (url) {
    const response: AxiosResponse = await axios.get(url);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const track of response.data.data as any[]) {
      if (!track.preview) continue;
      songs.push({
        id: String(track.id),
        title: track.title as string,
        artists: [track.artist.name as string],
        albumArt: (track.album?.cover_medium as string) ?? null,
        previewUrl: track.preview as string,
      });
    }

    url = (response.data.next as string) || null;
    if (songs.length >= 200) break;
  }

  return songs;
}

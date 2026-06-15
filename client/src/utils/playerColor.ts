const PLAYER_COLORS = [
  '#f87171', '#fb923c', '#facc15', '#4ade80', '#34d399',
  '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6', '#e879f9',
];

export function playerColor(username: string): string {
  let hash = 5381;
  for (let i = 0; i < username.length; i++) {
    hash = ((hash << 5) + hash) ^ username.charCodeAt(i);
    hash = hash & hash;
  }
  return PLAYER_COLORS[Math.abs(hash) % PLAYER_COLORS.length];
}

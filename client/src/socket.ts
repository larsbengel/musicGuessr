import { io } from 'socket.io-client';

function getPlayerId(): string {
  let id = sessionStorage.getItem('mg_playerId');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('mg_playerId', id);
  }
  return id;
}

export const playerId = getPlayerId();

// Connect to same origin — Vite proxies /socket.io → localhost:3001
const socket = io({ autoConnect: false });

export default socket;

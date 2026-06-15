import { Server, Socket } from 'socket.io';
import { setupLobbyHandlers } from './lobbyHandlers';
import { setupGameHandlers } from './gameHandlers';

export function setupSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    setupLobbyHandlers(io, socket);
    setupGameHandlers(io, socket);
  });
}

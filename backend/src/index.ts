import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createExpressApp } from './server.js';
import { setupSignaling } from './signaling/socketHandler.js';
import { config } from './config/env.js';

const app = createExpressApp();
const httpServer = http.createServer(app);

// Socket.IO server for real-time signaling and control
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

setupSignaling(io);

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(config.PORT, '0.0.0.0', () => {
    console.log(`[OmniControl] Server running on port ${config.PORT} (0.0.0.0)`);
    console.log(`[OmniControl] Local Wi-Fi endpoint: http://172.16.34.44:${config.PORT}`);
    console.log(`[OmniControl] Signaling server ready for WebRTC peer connections`);
  });
}

export { httpServer, app, io };

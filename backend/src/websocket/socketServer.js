import { WebSocketServer, WebSocket } from 'ws';

let wss = null;
const clients = new Set();

/**
 * Initializes WebSocket Server on the existing HTTP server instance
 */
export function initWebSocketServer(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    clients.add(ws);
    // Send immediate greeting
    ws.send(JSON.stringify({
      type: 'CONNECTED',
      message: 'Connected to Smart Cold-Chain Live Telemetry Feed',
      timestamp: new Date().toISOString()
    }));

    ws.on('message', (message) => {
      try {
        const parsed = JSON.parse(message);
        if (parsed.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
        }
      } catch (err) {
        // Ignore non-json
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', () => {
      clients.delete(ws);
    });
  });

  console.log('--- WebSocket Server Initialized on /ws ---');
  return wss;
}

/**
 * Broadcast event to all active clients
 */
export function broadcast(payload) {
  if (!wss) return;

  const data = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(data);
      } catch (e) {
        clients.delete(client);
      }
    }
  }
}

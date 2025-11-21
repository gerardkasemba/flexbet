// lib/websocket-server.ts
import { WebSocketServer, WebSocket } from 'ws';

// Store connected clients
const clients = new Set<WebSocket>();
const activeSubscriptions = new Map<string, Set<WebSocket>>(); // espnId -> clients

// WebSocket server instance
export const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws) => {
  console.log('🔌 New WebSocket connection');
  clients.add(ws);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      handleClientMessage(ws, data);
    } catch (error) {
      console.error('❌ Error parsing client message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
    clients.delete(ws);
    // Remove from all subscriptions
    activeSubscriptions.forEach((subscribedClients, espnId) => {
      subscribedClients.delete(ws);
      if (subscribedClients.size === 0) {
        activeSubscriptions.delete(espnId);
      }
    });
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
    clients.delete(ws);
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to live scores service',
    timestamp: new Date().toISOString()
  }));
});

function handleClientMessage(ws: WebSocket, data: any) {
  const { type, espnId } = data;

  switch (type) {
    case 'subscribe':
      if (espnId) {
        subscribeToGame(ws, espnId);
      }
      break;

    case 'unsubscribe':
      if (espnId) {
        unsubscribeFromGame(ws, espnId);
      }
      break;

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      break;

    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
  }
}

function subscribeToGame(ws: WebSocket, espnId: string) {
  if (!activeSubscriptions.has(espnId)) {
    activeSubscriptions.set(espnId, new Set());
  }
  activeSubscriptions.get(espnId)!.add(ws);
  
  console.log(`📡 Client subscribed to game ${espnId}`);
  ws.send(JSON.stringify({
    type: 'subscribed',
    espnId,
    message: `Subscribed to game ${espnId}`
  }));
}

function unsubscribeFromGame(ws: WebSocket, espnId: string) {
  const subscribers = activeSubscriptions.get(espnId);
  if (subscribers) {
    subscribers.delete(ws);
    if (subscribers.size === 0) {
      activeSubscriptions.delete(espnId);
    }
  }
  
  ws.send(JSON.stringify({
    type: 'unsubscribed',
    espnId,
    message: `Unsubscribed from game ${espnId}`
  }));
}

// Function to broadcast game updates to subscribed clients
export function broadcastGameUpdate(espnId: string, gameData: any) {
  const subscribers = activeSubscriptions.get(espnId);
  if (!subscribers || subscribers.size === 0) return;

  const updateMessage = {
    type: 'game_update',
    espnId,
    data: gameData,
    timestamp: new Date().toISOString()
  };

  const messageString = JSON.stringify(updateMessage);
  let deliveredCount = 0;

  subscribers.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(messageString);
      deliveredCount++;
    }
  });

  console.log(`📢 Broadcast update for ${espnId} to ${deliveredCount} clients`);
}

// Health check function
export function getWebSocketStatus() {
  return {
    connectedClients: clients.size,
    activeSubscriptions: Array.from(activeSubscriptions.entries()).map(([espnId, subscribers]) => ({
      espnId,
      subscriberCount: subscribers.size
    })),
    totalGamesBeingTracked: activeSubscriptions.size
  };
}
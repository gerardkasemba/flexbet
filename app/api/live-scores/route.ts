// app/api/live-scores/route.ts
import { NextRequest } from 'next/server';
import { getWebSocketStatus } from '@/lib/websocket-server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'status') {
      return Response.json({
        status: 'running',
        ...getWebSocketStatus()
      });
    }

    return Response.json({
      message: 'WebSocket server is running',
      usage: 'Connect via WebSocket to receive live updates',
      endpoints: {
        subscribe: 'Send { type: "subscribe", espnId: "123" }',
        unsubscribe: 'Send { type: "unsubscribe", espnId: "123" }',
        ping: 'Send { type: "ping" }'
      }
    });

  } catch (error) {
    console.error('Error in WebSocket API:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return Response.json({ message: 'Use WebSocket protocol to connect' });
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
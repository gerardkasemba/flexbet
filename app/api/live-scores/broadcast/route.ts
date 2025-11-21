// app/api/live-scores/broadcast/route.ts
import { NextRequest } from 'next/server';
import { broadcastGameUpdate } from '@/lib/websocket-server';

export async function POST(request: NextRequest) {
  try {
    const { espnId, gameData } = await request.json();
    
    if (!espnId || !gameData) {
      return Response.json({ error: 'Missing espnId or gameData' }, { status: 400 });
    }

    broadcastGameUpdate(espnId, gameData);
    
    return Response.json({ 
      success: true, 
      message: `Update broadcast for ${espnId}` 
    });
  } catch (error) {
    console.error('Error broadcasting update:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
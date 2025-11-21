// app/api/espn/game/[espnId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { broadcastGameUpdate } from '@/lib/websocket-server'

// Cache to avoid excessive API calls
const cache = new Map();
const CACHE_DURATION = 10000; // 10 seconds

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ espnId: string }> }
) {
  const { espnId } = await params;

  try {
    // Check cache first
    const cached = cache.get(espnId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`📦 Serving cached data for ${espnId}`);
      return NextResponse.json(cached.data);
    }

    // Try multiple ESPN endpoints for different sports
    const endpoints = [
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${espnId}`,
      `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/summary?event=${espnId}`,
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${espnId}`,
      `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${espnId}`,
      `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${espnId}`,
    ];

    let gameData = null;
    let successfulEndpoint = '';

    for (const endpoint of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(endpoint, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SportsApp/1.0)',
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          gameData = transformESPNData(data);
          if (gameData.homeScore !== undefined && gameData.awayScore !== undefined) {
            successfulEndpoint = endpoint;
            break;
          }
        }
      } catch (error) {
        console.log(`Failed to fetch from ${endpoint}:`, error);
        continue;
      }
    }

    if (!gameData) {
      return NextResponse.json(
        { error: 'Game not found or no score data available' },
        { status: 404 }
      );
    }

    // Cache the result
    cache.set(espnId, {
      data: gameData,
      timestamp: Date.now(),
      endpoint: successfulEndpoint
    });

    // Broadcast update to WebSocket subscribers if the game is active
    if (isGameActive(gameData.status)) {
      try {
        broadcastGameUpdate(espnId, gameData);
      } catch (wsError) {
        console.error('Error broadcasting update:', wsError);
        // Don't fail the request if WebSocket broadcast fails
      }
    }

    return NextResponse.json(gameData);
  } catch (error: any) {
    console.error('Error fetching ESPN data:', error);
    
    // Handle specific error types
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout' },
        { status: 408 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function transformESPNData(espnData: any) {
  try {
    const header = espnData.header;
    const competitions = espnData.header?.competitions?.[0];
    const competitors = competitions?.competitors || [];

    const homeTeam = competitors.find((c: any) => c.homeAway === 'home');
    const awayTeam = competitors.find((c: any) => c.homeAway === 'away');

    const gameData = {
      homeScore: homeTeam?.score ? parseInt(homeTeam.score) : 0,
      awayScore: awayTeam?.score ? parseInt(awayTeam.score) : 0,
      status: header?.status?.type?.state || 'unknown',
      period: header?.status?.period || 0,
      clock: header?.status?.displayClock || '',
      completed: header?.status?.type?.completed || false,
      detail: header?.status?.type?.detail || '',
      name: header?.competitions?.[0]?.name || '',
      homeTeam: {
        name: homeTeam?.team?.displayName || 'Home Team',
        abbreviation: homeTeam?.team?.abbreviation || 'HOME',
        logo: homeTeam?.team?.logo || ''
      },
      awayTeam: {
        name: awayTeam?.team?.displayName || 'Away Team',
        abbreviation: awayTeam?.team?.abbreviation || 'AWAY',
        logo: awayTeam?.team?.logo || ''
      },
      lastUpdated: new Date().toISOString()
    };

    return gameData;
  } catch (error) {
    console.error('Error transforming ESPN data:', error);
    return {
      homeScore: 0,
      awayScore: 0,
      status: 'unknown',
      period: 0,
      clock: '',
      completed: false,
      detail: '',
      name: '',
      homeTeam: { name: 'Home Team', abbreviation: 'HOME', logo: '' },
      awayTeam: { name: 'Away Team', abbreviation: 'AWAY', logo: '' },
      lastUpdated: new Date().toISOString()
    };
  }
}

function isGameActive(status: string): boolean {
  const activeStatuses = ['in', 'halftime', 'review', 'delayed'];
  return activeStatuses.includes(status);
}

// Add OPTIONS method for CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useLiveScores } from '@/hooks/useLiveScores';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Team {
  name: string;
  short_name: string;
  logo_url: string;
}

interface Market {
  id: string;
  espn_id: string;
  team_a_score: number;
  team_b_score: number;
  status: string;
  match_date: string;
  team_a_id: string;
  team_b_id: string;
  team_a: Team[]; // Array due to Supabase joins
  team_b: Team[]; // Array due to Supabase joins
}

interface LiveGame {
  id: string;
  espn_id: string;
  team_a_score: number;
  team_b_score: number;
  status: string;
  team_a_name: string;
  team_b_name: string;
  team_a_short_name?: string;
  team_b_short_name?: string;
  team_a_logo?: string;
  team_b_logo?: string;
}

// Create a wrapper component for individual game updates
function LiveGameWithUpdates({ game }: { game: LiveGame }) {
  const { gameData, isConnected } = useLiveScores(game.espn_id, game.id);
  
  const currentGame = gameData ? {
    ...game,
    team_a_score: gameData.awayScore ?? game.team_a_score,
    team_b_score: gameData.homeScore ?? game.team_b_score,
    status: mapESPNStatusToMarketStatus(gameData.status) ?? game.status
  } : game;

  const getTeamDisplayName = (teamName: string, shortName?: string) => {
    return shortName || teamName.substring(0, 3).toUpperCase();
  };

  return (
    <div className="flex justify-between items-center text-xs p-2 rounded border">
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          {/* Team A with logo */}
          <div className="flex items-center space-x-1 flex-1">
            {game.team_a_logo ? (
              <img 
                src={game.team_a_logo} 
                alt={game.team_a_name}
                className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-4 h-4 bg-gray-200 rounded-full flex items-center justify-center text-[8px] font-medium text-gray-600 flex-shrink-0">
                {getTeamDisplayName(game.team_a_name, game.team_a_short_name).substring(0, 2)}
              </div>
            )}
            <span className="font-medium truncate text-xs">
              {getTeamDisplayName(game.team_a_name, game.team_a_short_name)}
            </span>
          </div>

          {/* Score */}
          <div className="font-mono text-sm font-bold mx-2 flex-shrink-0">
            {currentGame.team_a_score}-{currentGame.team_b_score}
          </div>

          {/* Team B with logo */}
          <div className="flex items-center space-x-1 flex-1 justify-end">
            <span className="font-medium truncate text-xs">
              {getTeamDisplayName(game.team_b_name, game.team_b_short_name)}
            </span>
            {game.team_b_logo ? (
              <img 
                src={game.team_b_logo} 
                alt={game.team_b_name}
                className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-4 h-4 bg-gray-200 rounded-full flex items-center justify-center text-[8px] font-medium text-gray-600 flex-shrink-0">
                {getTeamDisplayName(game.team_b_name, game.team_b_short_name).substring(0, 2)}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center space-x-2">
            <span className={`px-1.5 py-0.5 rounded text-xs ${
              currentGame.status === 'live' ? 'bg-red-100 text-red-800' :
              currentGame.status === 'closed' ? 'bg-orange-100 text-orange-800' :
              currentGame.status === 'resolved' ? 'bg-green-100 text-green-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {currentGame.status}
            </span>
            {isConnected && (
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            )}
          </div>
          
          {/* Full team names (truncated) */}
          <div className="text-xs text-gray-500 truncate flex-1 text-right ml-2">
            <span className="truncate">
              {game.team_a_name} vs {game.team_b_name}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function mapESPNStatusToMarketStatus(espnStatus: string): string {
  const statusMap: { [key: string]: string } = {
    'in': 'live',
    'halftime': 'live',
    'post': 'closed',
    'final': 'closed',
    'closed': 'closed',
    'suspended': 'suspended',
    'completed': 'closed',
    'full-time': 'closed'
  };
  
  return statusMap[espnStatus] || 'open';
}

// Custom hook to track overall connection status
function useConnectionStatus(liveGames: LiveGame[]) {
  const [overallConnectionStatus, setOverallConnectionStatus] = useState<'connected' | 'polling'>('connected');
  const [anyGameConnected, setAnyGameConnected] = useState(false);

  useEffect(() => {
    const hasConnectedGames = liveGames.length > 0;
    
    if (hasConnectedGames) {
      setOverallConnectionStatus('connected');
      setAnyGameConnected(true);
    } else {
      setOverallConnectionStatus('polling');
      setAnyGameConnected(false);
    }
  }, [liveGames.length]);

  return {
    connectionStatus: overallConnectionStatus,
    anyGameConnected
  };
}

export default function ScoreUpdater() {
  const [liveGames, setLiveGames] = useState<LiveGame[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [teamLogos, setTeamLogos] = useState<Map<string, string>>(new Map());
  
  const { connectionStatus, anyGameConnected } = useConnectionStatus(liveGames);

  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  // Fetch team logos
  useEffect(() => {
    const fetchTeamLogos = async () => {
      try {
        const teamIds = new Set<string>();
        liveGames.forEach(game => {
          // Add team IDs if available
        });

        if (teamIds.size > 0) {
          const { data: teams, error } = await supabase
            .from('teams')
            .select('id, logo_url, name')
            .in('id', Array.from(teamIds));

          if (error) {
            console.error('Error fetching team logos:', error);
            return;
          }

          if (teams) {
            const newLogos = new Map<string, string>();
            teams.forEach(team => {
              if (team.logo_url) {
                newLogos.set(team.id, team.logo_url);
              }
            });
            setTeamLogos(newLogos);
          }
        }
      } catch (error) {
        console.error('Error in fetchTeamLogos:', error);
      }
    };

    fetchTeamLogos();
  }, [liveGames]);

  // Fallback polling
  useEffect(() => {
    if (anyGameConnected) return;

    const pollInterval = setInterval(() => {
      console.log('📡 Using fallback polling for score updates');
      fetchActiveGames();
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [anyGameConnected]);

  // Initial fetch
  useEffect(() => {
    fetchActiveGames();
  }, []);

  const fetchActiveGames = async () => {
    try {
      const { data: markets, error } = await supabase
        .from('markets')
        .select(`
          id,
          espn_id,
          team_a_score,
          team_b_score,
          status,
          match_date,
          team_a_id,
          team_b_id,
          team_a:team_a_id(name, short_name, logo_url),
          team_b:team_b_id(name, short_name, logo_url)
        `)
        .in('status', ['open', 'live', 'suspended'])
        .gte('match_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .lte('match_date', new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString())
        .not('espn_id', 'is', null);

      if (error) {
        console.error('Error fetching active games:', error);
        return;
      }

      if (markets) {
        const gamesWithTeamDetails: LiveGame[] = markets.map((market) => {
          // FIX: Access the first element of the array
          const teamA = market.team_a?.[0];
          const teamB = market.team_b?.[0];

          return {
            id: market.id,
            espn_id: market.espn_id,
            team_a_score: market.team_a_score,
            team_b_score: market.team_b_score,
            status: market.status,
            team_a_name: teamA?.name || 'Unknown Team',
            team_b_name: teamB?.name || 'Unknown Team',
            team_a_short_name: teamA?.short_name || teamA?.name?.substring(0, 3).toUpperCase() || 'TMA',
            team_b_short_name: teamB?.short_name || teamB?.name?.substring(0, 3).toUpperCase() || 'TMB',
            team_a_logo: teamA?.logo_url || undefined,
            team_b_logo: teamB?.logo_url || undefined
          };
        });

        setLiveGames(gamesWithTeamDetails);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Error in fetchActiveGames:', error);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getConnectionStatusColor = () => {
    return connectionStatus === 'connected' ? 'bg-green-500' : 'bg-orange-500';
  };

  const getConnectionStatusText = () => {
    return connectionStatus === 'connected' ? 'Live' : 'Polling';
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 border max-w-sm z-50">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-gray-900 text-sm">Live Scores</h3>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500 font-mono">
            {formatTime(currentTime)}
          </span>
          <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor()}`}></div>
          <span className="text-xs text-gray-500">{getConnectionStatusText()}</span>
        </div>
      </div>
      
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {liveGames.map(game => (
          <LiveGameWithUpdates key={game.id} game={game} />
        ))}
        {liveGames.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-2">No active games</p>
        )}
      </div>
      
      <div className="mt-2 pt-2 border-t text-xs text-gray-500">
        <div className="flex justify-between">
          <span>Last update: {formatTime(lastUpdate)}</span>
          <span className={connectionStatus === 'polling' ? 'text-orange-600' : 'text-green-600'}>
            {connectionStatus === 'polling' ? 'Polling every 30s' : 'Real-time updates'}
          </span>
        </div>
        <span className="text-orange-600">Closed markets need admin settlement</span>
      </div>
    </div>
  );
}
// hooks/useLiveScores.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface GameUpdate {
  espnId: string;
  data: any;
  type: string;
  timestamp: string;
}

interface UseLiveScoresReturn {
  gameData: any;
  isConnected: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  refetch: () => void;
}

export function useLiveScores(espnId?: string, marketId?: string): UseLiveScoresReturn {
  const [gameData, setGameData] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [isConnected, setIsConnected] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastScoreRef = useRef<string>(''); // Track last score to avoid duplicate updates

  // Function to update database with new scores
  const updateDatabaseScores = useCallback(async (homeScore: number, awayScore: number, status: string) => {
    if (!marketId) return;

    const currentScore = `${homeScore}-${awayScore}-${status}`;
    
    // Only update if score has changed
    if (currentScore === lastScoreRef.current) {
      return;
    }

    try {
      console.log(`🔄 Updating database for market ${marketId}: ${awayScore}-${homeScore} (${status})`);
      
      const { data, error } = await supabase
        .from('markets')
        .update({
          team_a_score: awayScore,  // Assuming team_a is away team
          team_b_score: homeScore,  // Assuming team_b is home team
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', marketId)
        .select();

      if (error) {
        console.error('❌ Error updating market scores:', error);
      } else {
        console.log('✅ Successfully updated market scores:', data);
        lastScoreRef.current = currentScore;
      }
    } catch (error) {
      console.error('❌ Exception updating market scores:', error);
    }
  }, [marketId]);

  const fetchScore = useCallback(async () => {
    if (!espnId) return;

    try {
      setConnectionStatus('connecting');
      
      const response = await fetch(`/api/espn/game/${espnId}`);
      if (response.ok) {
        const data = await response.json();
        setGameData(data);
        setConnectionStatus('connected');
        setIsConnected(true);

        // Update database with new scores
        if (data.homeScore !== undefined && data.awayScore !== undefined && data.status) {
          const marketStatus = mapESPNStatusToMarketStatus(data.status);
          await updateDatabaseScores(data.homeScore, data.awayScore, marketStatus);
        }
      } else {
        setConnectionStatus('disconnected');
        setIsConnected(false);
      }
    } catch (error) {
      console.error('Error fetching live score:', error);
      setConnectionStatus('disconnected');
      setIsConnected(false);
    }
  }, [espnId, updateDatabaseScores]);

  useEffect(() => {
    if (!espnId) return;

    // Initial fetch
    fetchScore();

    // Set up polling every 30 seconds (reduced from 1 second to avoid rate limiting)
    intervalRef.current = setInterval(fetchScore, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [espnId, fetchScore]);

  const refetch = useCallback(() => {
    fetchScore();
  }, [fetchScore]);

  return {
    gameData,
    isConnected,
    connectionStatus,
    refetch
  };
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
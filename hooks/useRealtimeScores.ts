// hooks/useRealtimeScores.ts
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ScoreUpdate {
  teamAScore: number;
  teamBScore: number;
  status: string;
  clock?: string;
  period?: string;
}

interface Market {
  id: string;
  team_a_score: number;
  team_b_score: number;
  status: string;
  game_clock?: string;
  game_period?: number;
}

/**
 * Hook to subscribe to real-time score updates for a specific market
 * 
 * @param marketId - The market ID to subscribe to
 * @returns Current market data with real-time updates
 * 
 * @example
 * const { scores, loading } = useRealtimeScores(marketId);
 */
export function useRealtimeScores(marketId: string | null) {
  const [scores, setScores] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!marketId) {
      setLoading(false);
      return;
    }

    // Fetch initial data
    const fetchInitialScores = async () => {
      const { data, error } = await supabase
        .from('markets')
        .select('id, team_a_score, team_b_score, status, game_clock, game_period')
        .eq('id', marketId)
        .single();

      if (error) {
        console.error('Error fetching initial scores:', error);
      } else {
        setScores(data);
      }
      setLoading(false);
    };

    fetchInitialScores();

    // Subscribe to real-time updates using Supabase Realtime
    const channel = supabase
      .channel(`market:${marketId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'markets',
          filter: `id=eq.${marketId}`
        },
        (payload) => {
          console.log('📊 Real-time score update:', payload.new);
          setScores(payload.new as Market);
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      supabase.removeChannel(channel);
    };
  }, [marketId]);

  return { scores, loading };
}

/**
 * Hook to subscribe to real-time updates for multiple markets
 * 
 * @param marketIds - Array of market IDs to subscribe to
 * @returns Map of market IDs to their current scores
 * 
 * @example
 * const { scoresMap, loading } = useRealtimeMultipleScores(['id1', 'id2']);
 */
export function useRealtimeMultipleScores(marketIds: string[]) {
  const [scoresMap, setScoresMap] = useState<Map<string, Market>>(new Map());
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (marketIds.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch initial data for all markets
    const fetchInitialScores = async () => {
      const { data, error } = await supabase
        .from('markets')
        .select('id, team_a_score, team_b_score, status, game_clock, game_period')
        .in('id', marketIds);

      if (error) {
        console.error('Error fetching initial scores:', error);
      } else if (data) {
        const map = new Map<string, Market>();
        data.forEach(market => {
          map.set(market.id, market);
        });
        setScoresMap(map);
      }
      setLoading(false);
    };

    fetchInitialScores();

    // Subscribe to real-time updates for all markets
    const channel = supabase
      .channel('markets-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'markets',
        },
        (payload) => {
          const updatedMarket = payload.new as Market;
          if (marketIds.includes(updatedMarket.id)) {
            console.log('📊 Real-time score update:', updatedMarket);
            setScoresMap(prev => {
              const newMap = new Map(prev);
              newMap.set(updatedMarket.id, updatedMarket);
              return newMap;
            });
          }
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      supabase.removeChannel(channel);
    };
  }, [marketIds.join(',')]); // Dependency on stringified array

  return { scoresMap, loading };
}

/**
 * Hook to get live games count
 * 
 * @returns Number of currently live games
 */
export function useLiveGamesCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Fetch initial count
    const fetchCount = async () => {
      const { count: liveCount, error } = await supabase
        .from('markets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'live');

      if (error) {
        console.error('Error fetching live games count:', error);
      } else {
        setCount(liveCount || 0);
      }
      setLoading(false);
    };

    fetchCount();

    // Subscribe to status changes
    const channel = supabase
      .channel('live-games-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'markets',
        },
        () => {
          // Refetch count when any market changes
          fetchCount();
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { count, loading };
}
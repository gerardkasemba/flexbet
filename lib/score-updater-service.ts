// lib/score-updater-service.ts
import { createClient } from '@supabase/supabase-js';

interface GameUpdate {
  espnId: string;
  homeScore?: number;
  awayScore?: number;
  status?: string;
  completed?: boolean;
  lastUpdate?: string;
}

interface WebSocketMessage {
  type: 'game_update' | 'connected' | 'subscribed' | 'pong' | 'error';
  espnId?: string;
  data?: any;
  message?: string;
  timestamp?: string;
}

export class ScoreUpdaterService {
  private supabase;
  private isRunning = false;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;
  private subscribedGames = new Set<string>();
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️ Score updater service already running');
      return;
    }

    this.isRunning = true;
    console.log('🎯 Score updater service started');
    
    // Initial fetch of all active games
    await this.updateAllActiveGames();
    
    // Start WebSocket connection for real-time updates
    this.connectWebSocket();
    
    // Start fallback polling
    this.startFallbackPolling();
  }

  stop() {
    this.isRunning = false;
    
    // Close WebSocket connection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Clear polling interval
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    this.subscribedGames.clear();
    console.log('🛑 Score updater service stopped');
  }

  private connectWebSocket() {
    if (!this.isRunning) return;

    try {
      // Use the same origin for WebSocket to avoid CORS issues
      const protocol = window?.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') || 'localhost:3000';
      const wsUrl = `${protocol}//${host}/api/live-scores`;
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('🔌 WebSocket connected for real-time updates');
        this.reconnectAttempts = 0;
        // Subscribe to all active games
        this.subscribeToActiveGames();
      };

      this.ws.onmessage = async (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          await this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('❌ Error processing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log(`🔌 WebSocket disconnected: ${event.code} ${event.reason}`);
        this.subscribedGames.clear();
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };

    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
      this.attemptReconnect();
    }
  }

  private async handleWebSocketMessage(message: WebSocketMessage) {
    switch (message.type) {
      case 'connected':
        console.log('✅ WebSocket:', message.message);
        break;
      
      case 'subscribed':
        if (message.espnId) {
          console.log(`✅ Subscribed to game ${message.espnId}`);
          this.subscribedGames.add(message.espnId);
        }
        break;
      
      case 'game_update':
        if (message.espnId && message.data) {
          // Find the market ID for this ESPN ID
          const { data: market } = await this.supabase
            .from('markets')
            .select('id')
            .eq('espn_id', message.espnId)
            .single();

          if (market) {
            await this.processGameUpdate({
              espnId: message.espnId,
              homeScore: message.data.homeScore,
              awayScore: message.data.awayScore,
              status: message.data.status,
              completed: message.data.completed
            }, market.id);

            // 🔥 BROADCAST TO OTHER CLIENTS
            await this.broadcastScoreUpdate(message.espnId, {
              ...message.data,
              marketId: market.id
            });
          } else {
            console.error(`❌ Market not found for ESPN ID: ${message.espnId}`);
          }
        }
        break;
      
      case 'pong':
        // Keep alive response - no action needed
        break;
      
      case 'error':
        console.error('❌ WebSocket error:', message.message);
        break;
      
      default:
        console.log('📨 Unknown WebSocket message type:', message.type);
    }
  }

  private async subscribeToActiveGames() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('⚠️ WebSocket not ready for subscriptions');
      return;
    }

    try {
      const { data: markets, error } = await this.supabase
        .from('markets')
        .select('espn_id')
        .in('status', ['open', 'live', 'suspended'])
        .not('espn_id', 'is', null);

      if (error) {
        throw error;
      }

      if (!markets || markets.length === 0) {
        console.log('📭 No active games to subscribe to');
        return;
      }

      console.log(`📡 Subscribing to ${markets.length} active games`);
      
      for (const market of markets) {
        if (market.espn_id && !this.subscribedGames.has(market.espn_id)) {
          this.ws.send(JSON.stringify({
            type: 'subscribe',
            espnId: market.espn_id
          }));
          // Add to tracking set after sending subscription
          this.subscribedGames.add(market.espn_id);
        }
      }

    } catch (error) {
      console.error('❌ Error subscribing to active games:', error);
    }
  }

  private attemptReconnect() {
    if (!this.isRunning || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('📡 Max reconnection attempts reached, relying on polling');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 3); // Cap at 3x delay

    console.log(`🔄 Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connectWebSocket();
    }, delay);
  }

  private startFallbackPolling() {
    // Clear any existing interval
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    const poll = async () => {
      if (!this.isRunning) return;

      // Only use polling if WebSocket is not connected
      const isWebSocketConnected = this.ws && this.ws.readyState === WebSocket.OPEN;
      
      if (!isWebSocketConnected) {
        console.log('📡 Using fallback polling for score updates');
        await this.updateAllActiveGames();
      }
    };

    // Start polling immediately and then every 30 seconds
    poll();
    this.pollingInterval = setInterval(poll, 30000);
  }

  private async updateAllActiveGames() {
    try {
      const { data: markets, error } = await this.supabase
        .from('markets')
        .select(`
          id, 
          espn_id, 
          status,
          team_a_score,
          team_b_score,
          team_a_id,
          team_b_id
        `)
        .in('status', ['open', 'live', 'suspended'])
        .gte('match_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .lte('match_date', new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString())
        .not('espn_id', 'is', null);

      if (error) {
        throw error;
      }

      if (!markets || markets.length === 0) {
        console.log('📭 No active games found');
        return;
      }

      console.log(`🔄 Polling ${markets.length} active games`);

      // Process games in batches to avoid rate limiting
      const batchSize = 5;
      for (let i = 0; i < markets.length; i += batchSize) {
        const batch = markets.slice(i, i + batchSize);
        await Promise.allSettled(
          batch.map(market => {
            if (market.espn_id) {
              return this.updateMarketScores(market.id, market.espn_id);
            }
            return Promise.resolve();
          })
        );
        
        // Delay between batches
        if (i + batchSize < markets.length) {
          await this.delay(2000);
        }
      }

    } catch (error) {
      console.error('❌ Error updating active games:', error);
    }
  }

  private async updateMarketScores(marketId: string, espnId: string | undefined) {
    try {
      if (!espnId) {
        console.error('❌ No ESPN ID provided for market:', marketId);
        return;
      }
      
      const gameData = await this.fetchGameData(espnId);
      
      if (gameData && !gameData.error) {
        await this.processGameUpdate({
          espnId,
          homeScore: gameData.homeScore,
          awayScore: gameData.awayScore,
          status: gameData.status,
          completed: gameData.completed
        }, marketId);
      }
    } catch (error) {
      console.error(`❌ Error updating market ${marketId}:`, error);
    }
  }

  private async fetchGameData(espnId: string): Promise<any> {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${baseUrl}/api/espn/game/${espnId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error(`⏰ Timeout fetching game data for ${espnId}`);
      } else {
        console.error(`❌ Error fetching game data for ${espnId}:`, error);
      }
      return null;
    }
  }

  private async processGameUpdate(update: GameUpdate, marketId: string) {
    const updates: any = {};
    let hasChanges = false;

    // Check if scores have changed
    if (update.homeScore !== undefined) {
      updates.team_a_score = update.homeScore;
      hasChanges = true;
    }

    if (update.awayScore !== undefined) {
      updates.team_b_score = update.awayScore;
      hasChanges = true;
    }

    const newStatus = this.mapESPNStatusToMarketStatus(update.status);
    if (newStatus && newStatus !== 'unknown') {
      updates.status = newStatus;
      hasChanges = true;
    }

    updates.updated_at = new Date().toISOString();

    if (hasChanges) {
      try {
        const { error } = await this.supabase
          .from('markets')
          .update(updates)
          .eq('id', marketId);

        if (error) {
          console.error(`❌ Database error updating market ${marketId}:`, error);
        } else {
          console.log(`✅ Updated market ${marketId}:`, {
            scores: `${update.homeScore || '?'}-${update.awayScore || '?'}`,
            status: newStatus,
            source: this.ws?.readyState === WebSocket.OPEN ? 'websocket' : 'polling'
          });

          // 🔥 BROADCAST THE UPDATE TO WEBSOCKET CLIENTS
          await this.broadcastScoreUpdate(update.espnId, {
            homeScore: update.homeScore,
            awayScore: update.awayScore,
            status: update.status,
            completed: update.completed,
            marketId: marketId
          });

          if (updates.status === 'closed' || update.completed) {
            await this.closeMarketForSettlement(marketId, update);
          }
        }
      } catch (error) {
        console.error(`❌ Error updating market ${marketId}:`, error);
      }
    }
  }

  private async broadcastScoreUpdate(espnId: string, gameData: any) {
    try {
      // Only broadcast if we have meaningful data
      if (!espnId || (!gameData.homeScore && !gameData.awayScore && !gameData.status)) {
        return;
      }

      const broadcastData = {
        espnId,
        gameData: {
          homeScore: gameData.homeScore,
          awayScore: gameData.awayScore,
          status: gameData.status,
          completed: gameData.completed,
          marketId: gameData.marketId,
          timestamp: new Date().toISOString()
        }
      };

      // Broadcast via your API route
      const response = await fetch('/api/live-scores/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(broadcastData)
      });

      if (!response.ok) {
        console.error('❌ Failed to broadcast score update:', await response.text());
      } else {
        console.log('📢 Score update broadcast successfully');
      }
    } catch (error) {
      console.error('❌ Error broadcasting score update:', error);
      // Don't throw - we don't want to break the main update flow
    }
  }

  private mapESPNStatusToMarketStatus(espnStatus?: string): string {
    if (!espnStatus) return 'unknown';

    const statusMap: { [key: string]: string } = {
      'in': 'live',
      'halftime': 'live',
      'post': 'closed',
      'final': 'closed',
      'closed': 'closed',
      'suspended': 'suspended',
      'completed': 'closed',
      'full-time': 'closed',
      'ended': 'closed'
    };
    
    return statusMap[espnStatus.toLowerCase()] || 'open';
  }

  private async closeMarketForSettlement(marketId: string, gameData: GameUpdate) {
    try {
      const { error } = await this.supabase
        .from('markets')
        .update({
          status: 'closed',
          team_a_score: gameData.homeScore || 0,
          team_b_score: gameData.awayScore || 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', marketId);

      if (error) {
        console.error('❌ Error closing market for settlement:', error);
      } else {
        console.log(`📋 Market ${marketId} closed and ready for admin settlement`);
        await this.notifyAdmins(marketId, gameData);
        
        // Unsubscribe from this game since it's completed
        if (gameData.espnId) {
          this.subscribedGames.delete(gameData.espnId);
        }

        // 🔥 BROADSET CLOSED STATUS
        await this.broadcastScoreUpdate(gameData.espnId, {
          homeScore: gameData.homeScore,
          awayScore: gameData.awayScore,
          status: 'closed',
          completed: true,
          marketId: marketId
        });
      }
    } catch (error) {
      console.error('❌ Error in closeMarketForSettlement:', error);
    }
  }

  private async notifyAdmins(marketId: string, gameData: GameUpdate) {
    try {
      const { data: market, error: marketError } = await this.supabase
        .from('markets')
        .select(`
          team_a_id,
          team_b_id,
          team_a_score,
          team_b_score
        `)
        .eq('id', marketId)
        .single();

      if (marketError) {
        console.error('❌ Error fetching market for notification:', marketError);
        return;
      }

      if (market) {
        const { data: teamA } = await this.supabase
          .from('teams')
          .select('name')
          .eq('id', market.team_a_id)
          .single();

        const { data: teamB } = await this.supabase
          .from('teams')
          .select('name')
          .eq('id', market.team_b_id)
          .single();

        const notification = {
          type: 'market_ready_for_settlement',
          title: 'Market Ready for Settlement',
          message: `${teamA?.name || 'Team A'} vs ${teamB?.name || 'Team B'} has ended and is ready for settlement. Final score: ${market.team_a_score}-${market.team_b_score}`,
          metadata: {
            market_id: marketId,
            home_score: market.team_a_score,
            away_score: market.team_b_score
          },
          created_at: new Date().toISOString()
        };

        console.log('📢 Admin Notification:', notification);
        
        // Store notification in database with proper error handling
        const { error: notificationError } = await this.supabase
          .from('admin_notifications')
          .insert(notification);

        if (notificationError) {
          console.error('❌ Failed to store notification:', notificationError);
        }
      }
    } catch (error: any) {
      console.error('❌ Error notifying admins:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Method to manually trigger an update for specific games
  async updateSpecificGames(espnIds: string[]) {
    console.log(`🔄 Manually updating ${espnIds.length} games`);
    
    // First, find the market IDs for these ESPN IDs
    const { data: markets } = await this.supabase
      .from('markets')
      .select('id, espn_id')
      .in('espn_id', espnIds);

    if (!markets) {
      console.error('❌ No markets found for the provided ESPN IDs');
      return;
    }

    for (const market of markets) {
      if (market.espn_id) {
        await this.updateMarketScores(market.id, market.espn_id);
        await this.delay(1000); // Rate limiting
      }
    }
  }

  // Method to get service status
  getStatus() {
    const wsStatus = this.ws ? 
      this.ws.readyState === WebSocket.OPEN ? 'connected' :
      this.ws.readyState === WebSocket.CONNECTING ? 'connecting' :
      this.ws.readyState === WebSocket.CLOSING ? 'closing' : 'disconnected'
      : 'not_connected';

    return {
      isRunning: this.isRunning,
      websocketStatus: wsStatus,
      reconnectAttempts: this.reconnectAttempts,
      subscribedGames: this.subscribedGames.size,
      pollingActive: !!this.pollingInterval
    };
  }
}

// Singleton instance
export const scoreUpdaterService = new ScoreUpdaterService();
//lib/trading/order-manager.ts - CORRECTED VERSION

import { createClient } from '@/lib/supabase/client';
import { AMMCalculator, TradeResult, MarketState } from '@/lib/amm/calculator';

export interface OrderRequest {
  userId: string;
  marketId: string;
  outcomeId: string;
  orderType: 'market_buy' | 'market_sell' | 'limit_buy' | 'limit_sell';
  amount: number;
  priceLimit?: number;
}

export interface OrderResponse {
  success: boolean;
  orderId?: string;
  status: 'filled' | 'partial' | 'pending' | 'rejected';
  message: string;
  execution?: {
    executedShares: number;
    executedPrice: number;
    totalAmount: number;
    fees: number;
  };
  estimatedWait?: number;
  errorDetails?: any;
}

export class OrderManager {
  private amm: AMMCalculator;
  private supabase;

  constructor() {
    this.amm = new AMMCalculator({
      feeRate: 0.03,
      minPrice: 0.01,
      maxPrice: 0.99
    });
    this.supabase = createClient();
  }

  /**
   * Execute a market order immediately using AMM
   */
  async executeMarketOrder(order: OrderRequest): Promise<OrderResponse> {
    try {
      console.log('=== ORDER EXECUTION START ===');
      console.log('📋 Order request:', JSON.stringify(order, null, 2));

      // Validate user balance and market status
      console.log('🔍 Step 1: Validating order...');
      const validation = await this.validateOrder(order);
      if (!validation.valid) {
        console.error('❌ Validation failed:', validation.message);
        return {
          success: false,
          status: 'rejected',
          message: validation.message!,
          errorDetails: { step: 'validation', reason: validation.message }
        };
      }
      console.log('✅ Validation passed');

      // Get current market state
      console.log('🔍 Step 2: Loading market state...');
      const marketState = await this.getMarketState(order.marketId);
      if (!marketState) {
        console.error('❌ Market state not found');
        return {
          success: false,
          status: 'rejected',
          message: 'Market not found or inactive',
          errorDetails: { step: 'market_state', reason: 'Market not found' }
        };
      }

      // Validate AMM state before proceeding
      if (!this.amm.validateMarketState(marketState)) {
        console.warn('⚠️ AMM state invalid, attempting to rebalance...');
        try {
          // Try to rebalance the market
          const rebalancedState = this.amm.rebalanceMarket(marketState);
          if (this.amm.validateMarketState(rebalancedState)) {
            console.log('✅ Market rebalanced successfully');
            // Update the market state with rebalanced values
            await this.updateMarketState(order.marketId, rebalancedState);
            // Use rebalanced state for calculation
            Object.assign(marketState, rebalancedState);
          } else {
            console.error('❌ Market rebalancing failed');
            return {
              success: false,
              status: 'rejected',
              message: 'Market configuration error - please try again',
              errorDetails: { step: 'amm_validation', reason: 'Invalid market state after rebalancing' }
            };
          }
        } catch (rebalanceError) {
          console.error('❌ Market rebalancing error:', rebalanceError);
          return {
            success: false,
            status: 'rejected',
            message: 'Market needs rebalancing - please contact support',
            errorDetails: { step: 'amm_rebalancing', error: rebalanceError }
          };
        }
      }

      console.log('✅ Market state loaded and validated:', {
        outcomes: Object.keys(marketState.outcomes).length,
        kConstant: marketState.kConstant,
        totalLiquidity: marketState.totalLiquidity
      });

      // Execute trade using AMM
      console.log('🔍 Step 3: Calculating AMM trade...');
      let tradeResult: TradeResult;
      try {
        if (order.orderType === 'market_buy') {
          tradeResult = this.amm.calculateBuy(marketState, order.outcomeId, order.amount);
        } else {
          tradeResult = this.amm.calculateSell(marketState, order.outcomeId, order.amount);
        }
        console.log('✅ AMM calculation complete:', {
          sharesReceived: tradeResult.sharesReceived,
          effectivePrice: tradeResult.effectivePrice,
          fees: tradeResult.fees,
          priceImpact: tradeResult.priceImpact,
          hasNewReserves: !!tradeResult.newReserves,
          hasNewPrices: !!tradeResult.newPrices
        });
      } catch (ammError) {
        console.error('❌ AMM calculation error:', ammError);
        return {
          success: false,
          status: 'rejected',
          message: `AMM calculation failed: ${ammError instanceof Error ? ammError.message : 'Unknown error'}`,
          errorDetails: { 
            step: 'amm_calculation', 
            error: ammError instanceof Error ? ammError.message : String(ammError) 
          }
        };
      }

      // Check if we have sufficient liquidity
      if (order.orderType === 'market_buy' && tradeResult.sharesReceived === 0) {
        console.warn('⚠️ Insufficient liquidity, queueing order');
        return await this.queueOrder(order, 'Insufficient liquidity, queuing order');
      }

      // Execute the trade in database using RPC function
      console.log('🔍 Step 4: Executing trade in database...');
      const execution = await this.executeTradeInDatabase(order, tradeResult, marketState);

      if (!execution.success) {
        console.error('❌ Database execution failed:', execution.message);
        return {
          success: false,
          status: 'rejected',
          message: execution.message || 'Database execution failed',
          errorDetails: { 
            step: 'database_execution', 
            details: execution.errorDetails 
          }
        };
      }

      console.log('✅ Trade executed successfully!');
      console.log('=== ORDER EXECUTION END ===');

      return {
        success: true,
        orderId: execution.orderId,
        status: 'filled',
        message: 'Order executed successfully',
        execution: {
          executedShares: tradeResult.sharesReceived,
          executedPrice: tradeResult.effectivePrice,
          totalAmount: order.orderType === 'market_buy' ? order.amount : tradeResult.totalCost,
          fees: tradeResult.fees
        }
      };

    } catch (error) {
      console.error('❌ CRITICAL ERROR in executeMarketOrder:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      console.log('=== ORDER EXECUTION FAILED ===');
      
      return {
        success: false,
        status: 'rejected',
        message: error instanceof Error ? error.message : 'Order execution failed',
        errorDetails: {
          step: 'critical_error',
          error: error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack
          } : String(error)
        }
      };
    }
  }

  /**
   * Validate order before execution
   */
  private async validateOrder(order: OrderRequest): Promise<{ valid: boolean; message?: string }> {
    console.log('  📝 Validating market status...');
    
    // Check market status
    const { data: market, error: marketError } = await this.supabase
      .from('markets')
      .select('status, trading_enabled')
      .eq('id', order.marketId)
      .single();

    if (marketError) {
      console.error('  ❌ Market query error:', marketError);
      return { valid: false, message: `Failed to fetch market: ${marketError.message}` };
    }

    if (!market || market.status !== 'open' || !market.trading_enabled) {
      return { valid: false, message: 'Market is not open for trading' };
    }
    console.log('  ✅ Market is open and trading enabled');

    // Check user balance for buy orders
    if (order.orderType.includes('buy')) {
      console.log('  📝 Validating user balance...');
      
      const { data: profile, error: profileError } = await this.supabase
        .from('profiles')
        .select('balance')
        .eq('id', order.userId)
        .single();

      if (profileError) {
        console.error('  ❌ Profile query error:', profileError);
        return { valid: false, message: `Failed to fetch user balance: ${profileError.message}` };
      }

      // Include fees in balance check (3% platform fee)
      const totalCost = order.amount * 1.03;
      if (!profile || profile.balance < totalCost) {
        return { 
          valid: false, 
          message: `Insufficient balance. Required: $${totalCost.toFixed(2)} (including fees), Available: $${profile?.balance || 0}` 
        };
      }
      console.log('  ✅ User has sufficient balance:', profile.balance);
    }

    // Check user shares for sell orders
    if (order.orderType.includes('sell')) {
      console.log('  📝 Validating user shares...');
      
      const { data: position, error: positionError } = await this.supabase
        .from('positions')
        .select('shares_owned')
        .eq('user_id', order.userId)
        .eq('market_id', order.marketId)
        .eq('outcome_id', order.outcomeId)
        .single();

      if (positionError && positionError.code !== 'PGRST116') {
        console.error('  ❌ Position query error:', positionError);
        return { valid: false, message: `Failed to fetch user position: ${positionError.message}` };
      }

      const sharesOwned = position?.shares_owned || 0;
      if (sharesOwned < order.amount) {
        return { 
          valid: false, 
          message: `Insufficient shares. Required: ${order.amount}, Available: ${sharesOwned}` 
        };
      }
      console.log('  ✅ User has sufficient shares:', sharesOwned);
    }

    return { valid: true };
  }

  /**
   * Get current market state for AMM calculations
   */
  private async getMarketState(marketId: string): Promise<MarketState | null> {
    try {
      const { data: market, error } = await this.supabase
        .from('markets')
        .select(`
          total_liquidity,
          k_constant,
          market_outcomes (
            id,
            total_shares,
            reserve,
            current_price
          )
        `)
        .eq('id', marketId)
        .single();

      if (error) {
        console.error('  ❌ Market state query error:', error);
        return null;
      }

      if (!market || !market.market_outcomes || market.market_outcomes.length === 0) {
        console.error('  ❌ No market outcomes found');
        return null;
      }

      const outcomes: MarketState['outcomes'] = {};
      market.market_outcomes.forEach((outcome: any) => {
        outcomes[outcome.id] = {
          shares: outcome.total_shares || 0,
          reserve: outcome.reserve || 0,
          currentPrice: outcome.current_price || 0
        };
      });

      const marketState = {
        outcomes,
        totalLiquidity: market.total_liquidity || 0,
        kConstant: market.k_constant || 0
      };

      console.log('  ✅ Market state loaded:', {
        outcomeCount: Object.keys(outcomes).length,
        kConstant: marketState.kConstant,
        reserves: Object.fromEntries(
          Object.entries(outcomes).map(([id, o]) => [id, o.reserve])
        )
      });

      return marketState;
    } catch (error) {
      console.error('  ❌ getMarketState error:', error);
      return null;
    }
  }

  /**
   * Update market state in database after rebalancing
   */
  private async updateMarketState(marketId: string, marketState: MarketState): Promise<boolean> {
    try {
      // Update each outcome's reserve and price
      const updates = Object.entries(marketState.outcomes).map(async ([outcomeId, outcome]) => {
        const { error } = await this.supabase
          .from('market_outcomes')
          .update({
            reserve: outcome.reserve,
            current_price: outcome.currentPrice,
            updated_at: new Date().toISOString()
          })
          .eq('id', outcomeId);

        if (error) {
          console.error(`  ❌ Failed to update outcome ${outcomeId}:`, error);
          return false;
        }
        return true;
      });

      const results = await Promise.all(updates);
      const allSuccessful = results.every(result => result);

      if (allSuccessful) {
        console.log('  ✅ Market state updated successfully');
      } else {
        console.error('  ❌ Some market state updates failed');
      }

      return allSuccessful;
    } catch (error) {
      console.error('  ❌ updateMarketState error:', error);
      return false;
    }
  }

  /**
   * Execute trade in database using RPC function for atomic transaction
   */
  private async executeTradeInDatabase(
    order: OrderRequest, 
    tradeResult: TradeResult,
    marketState: MarketState
  ): Promise<{ success: boolean; orderId?: string; message?: string; errorDetails?: any }> {
    try {
      // For market orders, we should use the execute_market_order RPC function
      // which handles the complete order matching + AMM execution
      const rpcParams: any = {
        p_user_id: order.userId,
        p_market_id: order.marketId,
        p_outcome_id: order.outcomeId,
        p_order_type: order.orderType
      };

      // Add amount or shares based on order type
      if (order.orderType === 'market_buy') {
        rpcParams.p_amount = order.amount;
      } else {
        rpcParams.p_shares = order.amount;
      }

      console.log('  📝 Calling execute_market_order RPC with params:', JSON.stringify(rpcParams, null, 2));

      // Call the main PostgreSQL function that handles order matching + AMM
      const { data, error } = await this.supabase.rpc('execute_market_order', rpcParams);

      if (error) {
        console.error('  ❌ RPC execute_market_order error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        
        // Check for specific AMM configuration errors
        if (error.message?.includes('AMM') || error.message?.includes('k_constant') || error.message?.includes('reserve')) {
          return {
            success: false,
            message: `Market configuration error: ${error.message}. Please try again.`,
            errorDetails: {
              issue: 'amm_configuration',
              code: error.code,
              message: error.message
            }
          };
        }
        
        return {
          success: false,
          message: `Database error: ${error.message}`,
          errorDetails: {
            issue: 'rpc_error',
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          }
        };
      }

      console.log('  ✅ RPC execute_market_order result:', data);

      // Check if the RPC function returned an error
      if (data && typeof data === 'object') {
        if ('success' in data && data.success === false) {
          console.error('  ❌ RPC function returned error:', data);
          return {
            success: false,
            message: data.error || 'Trade execution failed',
            errorDetails: {
              issue: 'rpc_function_error',
              data
            }
          };
        }

        if ('order_id' in data) {
          console.log('  ✅ Trade executed, order_id:', data.order_id);
          return {
            success: true,
            orderId: data.order_id,
            message: 'Trade executed successfully'
          };
        }

        // Handle partial fills
        if (data.status === 'partial') {
          console.log('  ⚠️ Trade partially filled:', data);
          return {
            success: true,
            orderId: data.order_id,
            message: 'Trade partially filled - remaining shares queued'
          };
        }
      }

      // Unexpected response format
      console.error('  ❌ Unexpected RPC response format:', data);
      return {
        success: false,
        message: 'Unexpected database response',
        errorDetails: {
          issue: 'unexpected_response',
          data
        }
      };

    } catch (error) {
      console.error('  ❌ executeTradeInDatabase error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Database execution failed',
        errorDetails: {
          issue: 'exception',
          error: error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack
          } : String(error)
        }
      };
    }
  }

  /**
   * Queue order when immediate execution isn't possible
   */
  private async queueOrder(order: OrderRequest, reason: string): Promise<OrderResponse> {
    console.log('  📝 Queueing order:', reason);
    
    try {
      const { data: queuedOrder, error } = await this.supabase
        .from('trade_orders')
        .insert({
          user_id: order.userId,
          market_id: order.marketId,
          outcome_id: order.outcomeId,
          order_type: order.orderType,
          order_status: 'pending',
          shares: order.orderType.includes('sell') ? order.amount : 0,
          total_amount: order.orderType.includes('buy') ? order.amount : 0,
          price_limit: order.priceLimit,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('  ❌ Queue order error:', error);
        return {
          success: false,
          status: 'rejected',
          message: `Failed to queue order: ${error.message}`,
          errorDetails: {
            step: 'queue_order',
            error: error.message,
            details: error.details
          }
        };
      }

      console.log('  ✅ Order queued successfully:', queuedOrder.id);
      
      return {
        success: true,
        orderId: queuedOrder.id,
        status: 'pending',
        message: `${reason}. Order queued for execution.`,
        estimatedWait: 300
      };
    } catch (error) {
      console.error('  ❌ Queue order exception:', error);
      return {
        success: false,
        status: 'rejected',
        message: `Failed to queue order: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errorDetails: {
          step: 'queue_order_exception',
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  /**
   * Cancel a pending order
   */
  async cancelOrder(orderId: string, userId: string): Promise<OrderResponse> {
    try {
      console.log('=== ORDER CANCELLATION START ===');
      console.log('Cancelling order:', orderId, 'for user:', userId);

      const { data, error } = await this.supabase.rpc('cancel_pending_order', {
        p_order_id: orderId,
        p_user_id: userId
      });

      if (error) {
        console.error('❌ Cancel order RPC error:', error);
        return {
          success: false,
          status: 'rejected',
          message: `Failed to cancel order: ${error.message}`,
          errorDetails: {
            step: 'cancel_rpc',
            error: error.message
          }
        };
      }

      if (data && data.success === false) {
        console.error('❌ Cancel order failed:', data.error);
        return {
          success: false,
          status: 'rejected',
          message: data.error || 'Failed to cancel order',
          errorDetails: {
            step: 'cancel_failed',
            data
          }
        };
      }

      console.log('✅ Order cancelled successfully');
      return {
        success: true,
        status: 'filled', // Using 'filled' to indicate successful cancellation
        message: 'Order cancelled successfully'
      };

    } catch (error) {
      console.error('❌ Cancel order error:', error);
      return {
        success: false,
        status: 'rejected',
        message: error instanceof Error ? error.message : 'Failed to cancel order',
        errorDetails: {
          step: 'cancel_exception',
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }
}
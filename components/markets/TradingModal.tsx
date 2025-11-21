'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { AMMCalculator } from '@/lib/amm/calculator'
import { FiX, FiTrendingUp, FiTrendingDown, FiDollarSign, FiInfo, FiAlertTriangle, FiClock, FiDatabase, FiRefreshCw } from 'react-icons/fi'

interface Market {
  id: string
  sport: { name: string }
  team_a: { name: string }
  team_b: { name: string }
  market_outcomes: Array<{
    id: string
    outcome_name: string
    current_price: number
    price_change_24h: number
    // Make these optional since they might not exist in the passed data
    outcome_type?: string
    total_shares?: number
    reserve?: number
    volume_24h?: number  // Add this to fix the second error
  }>
}

interface TradingModalProps {
  isOpen: boolean
  onClose: () => void
  market: Market
  outcomeId: string | null
}

interface MarketState {
  outcomes: {
    [outcomeId: string]: {
      shares: number;
      reserve: number;
      currentPrice: number;
    };
  };
  totalLiquidity: number;
  kConstant: number;
}

interface PendingOrder {
  id: string
  order_side: string
  shares: number
  executed_shares: number
  price_limit: number
  created_at: string
}

export default function TradingModal({ isOpen, onClose, market, outcomeId }: TradingModalProps) {
  const { user, profile, refreshProfile } = useAuth()
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [estimatedShares, setEstimatedShares] = useState(0)
  const [estimatedCost, setEstimatedCost] = useState(0)
  const [priceImpact, setPriceImpact] = useState(0)
  const [platformFee, setPlatformFee] = useState(0)
  const [marketState, setMarketState] = useState<MarketState | null>(null)
  const [orderStatus, setOrderStatus] = useState<'ready' | 'pending' | 'filled' | 'partial' | 'rejected'>('ready')
  const [estimatedWait, setEstimatedWait] = useState<number | null>(null)
  const [userShares, setUserShares] = useState(0)
  const [debugInfo, setDebugInfo] = useState<string>('')
  const [debugLogs, setDebugLogs] = useState<string[]>([])
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([])
  const [ammError, setAmmError] = useState<string>('')

  const supabase = createClient()
  const amm = new AMMCalculator({
    // feeRate: 0.03,
    feeRate: 0.00,
    minPrice: 0.01,
    maxPrice: 0.99
  })

  const selectedOutcome = market.market_outcomes.find(outcome => outcome.id === outcomeId)

  // Debug logging function
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const logMessage = `[${timestamp}] ${message}`
    console.log(logMessage)
    setDebugLogs(prev => [logMessage, ...prev.slice(0, 19)]) // Keep last 20 logs
    setDebugInfo(message)
  }

  // Safe number formatting to prevent overflow - matches exact database precision
  const safeNumber = (value: number, columnName?: string): number => {
    if (value === null || value === undefined || isNaN(value)) {
      addDebugLog(`⚠️ Invalid value for ${columnName}: ${value}, returning 0`)
      return 0;
    }
    
    // Prevent infinity and extremely large numbers
    if (!isFinite(value)) {
      addDebugLog(`⚠️ Non-finite value for ${columnName}: ${value}, returning 0`)
      return 0;
    }
    
    // Map column names to their specific precision requirements
    const precisionMap: { [key: string]: { precision: number; scale: number } } = {
      // numeric(16,8) - 8 decimal places
      shares: { precision: 16, scale: 8 },
      executed_shares: { precision: 16, scale: 8 },
      total_shares: { precision: 16, scale: 8 },
      shares_owned: { precision: 16, scale: 8 },
      reserve: { precision: 16, scale: 8 },
      
      // numeric(10,2) - 2 decimal places  
      total_amount: { precision: 10, scale: 2 },
      executed_amount: { precision: 10, scale: 2 },
      balance: { precision: 12, scale: 2 },
      fees: { precision: 10, scale: 2 },
      platform_fee: { precision: 10, scale: 2 },
      liquidity_fee: { precision: 10, scale: 2 },
      total_fees: { precision: 10, scale: 2 },
      total_invested: { precision: 12, scale: 2 },
      current_value: { precision: 12, scale: 2 },
      unrealized_pnl: { precision: 12, scale: 2 },
      realized_pnl: { precision: 12, scale: 2 },
      total_fees_paid: { precision: 10, scale: 2 },
      
      // numeric(8,6) - 6 decimal places
      price_limit: { precision: 8, scale: 6 },
      executed_price: { precision: 8, scale: 6 },
      price_impact: { precision: 8, scale: 6 },
      slippage: { precision: 8, scale: 6 },
      current_price: { precision: 8, scale: 6 },
      avg_buy_price: { precision: 8, scale: 6 },
      
      // Default fallbacks
      k_constant: { precision: 20, scale: 8 },
      fee_rate: { precision: 5, scale: 4 },
      unrealized_pnl_percent: { precision: 8, scale: 4 },
      price_change_24h: { precision: 8, scale: 4 }
    };

    const config = columnName ? precisionMap[columnName] : { precision: 8, scale: 6 };
    const scale = config?.scale || 6;
    
    // Round to the appropriate scale
    const fixedValue = parseFloat(value.toFixed(scale));
    
    // Calculate maximum value based on precision and scale
    const maxIntegerDigits = (config?.precision || 16) - scale;
    const maxValue = Math.pow(10, maxIntegerDigits) - Math.pow(10, -scale);
    
    // Clamp the value if it's too large
    if (Math.abs(fixedValue) > maxValue) {
      addDebugLog(`⚠️ Value ${value} exceeds max for ${columnName}, clamping to ${maxValue}`)
      return fixedValue > 0 ? maxValue : -maxValue;
    }
    
    return fixedValue;
  };

  // Fix AMM configuration for the current market
  const fixAmmConfiguration = async () => {
    addDebugLog('Attempting to fix AMM configuration...');
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.rpc('initialize_market_amm', {
        p_market_id: market.id,
        p_initial_liquidity_per_outcome: 10000
      });

      if (error) {
        addDebugLog(`❌ Failed to fix AMM: ${error.message}`);
        setAmmError(`Failed to fix market: ${error.message}`);
      } else {
        addDebugLog('✅ AMM configuration fixed successfully');
        setAmmError('');
        // Reload market state
        await loadMarketState();
      }
    } catch (error: any) {
      addDebugLog(`❌ AMM fix error: ${error.message}`);
      setAmmError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && market && outcomeId) {
      addDebugLog('Modal opened - loading initial data')
      loadMarketState()
      loadUserShares()
      loadPendingOrders()
      setOrderStatus('ready')
      setEstimatedWait(null)
      setAmmError('')
    }
  }, [isOpen, market, outcomeId])

  useEffect(() => {
    if (amount && selectedOutcome && marketState) {
      calculateTradeEstimation()
    } else {
      resetEstimations()
    }
  }, [amount, selectedOutcome, marketState, orderType])

  const loadMarketState = async () => {
    try {
      addDebugLog('Loading market state from database...')
      
      const { data: marketData, error } = await supabase
        .from('markets')
        .select(`
          id,
          total_liquidity,
          k_constant,
          liquidity_pools (
            total_liquidity,
            k_constant,
            available_liquidity
          ),
          market_outcomes (
            id,
            outcome_type,
            outcome_name,
            total_shares,
            reserve,
            current_price
          )
        `)
        .eq('id', market.id)
        .single()

      if (error) {
        addDebugLog(`Market query error: ${error.message}`)
        addDebugLog(`Error details: ${JSON.stringify(error)}`)
        throw error
      }

      addDebugLog(`Market data loaded: ${marketData.market_outcomes?.length || 0} outcomes`)

      const liquidityPool = marketData.liquidity_pools?.[0]
      const totalLiquidity = liquidityPool?.total_liquidity || marketData.total_liquidity || 10000
      const kConstant = liquidityPool?.k_constant || marketData.k_constant || 100000000

      const outcomes: MarketState['outcomes'] = {}
      marketData.market_outcomes.forEach((outcome: any) => {
        outcomes[outcome.id] = {
          shares: safeNumber(outcome.total_shares || 0, 'total_shares'),
          reserve: safeNumber(outcome.reserve || 1000, 'reserve'),
          currentPrice: safeNumber(outcome.current_price || 0.33, 'current_price')
        }
      })

      const newMarketState = {
        outcomes,
        totalLiquidity: safeNumber(totalLiquidity, 'balance'),
        kConstant: safeNumber(kConstant, 'k_constant')
      }

      setMarketState(newMarketState)
      
      // Validate AMM state
      validateAmmState(newMarketState)
      
      addDebugLog(`Market state set: $${totalLiquidity} liquidity, k=${kConstant}`)

    } catch (error: any) {
      console.error('Error loading market state:', error)
      addDebugLog(`Market state error: ${error.message}`)
      
      // Fallback to basic market state
      const fallbackOutcomes: MarketState['outcomes'] = {}
      market.market_outcomes.forEach(outcome => {
        fallbackOutcomes[outcome.id] = {
          shares: safeNumber(outcome.total_shares || 0, 'total_shares'),
          reserve: safeNumber(outcome.reserve || 1000, 'reserve'),
          currentPrice: safeNumber(outcome.current_price || 0.33, 'current_price')
        }
      })
      
      const fallbackState = {
        outcomes: fallbackOutcomes,
        totalLiquidity: 10000,
        kConstant: 100000000
      }
      
      setMarketState(fallbackState)
      validateAmmState(fallbackState)
      addDebugLog('Using fallback market state')
    }
  }

  // Validate AMM state and set error message if invalid
  const validateAmmState = (state: MarketState) => {
    if (!state || !selectedOutcome || !state.outcomes[selectedOutcome.id]) {
      setAmmError('Invalid market state');
      return false;
    }

    const outcome = state.outcomes[selectedOutcome.id];
    
    // Check AMM invariant: k ≈ reserve * shares (for the outcome being traded)
    const expectedKForOutcome = outcome.reserve * outcome.shares;
    const kDeviation = Math.abs(state.kConstant - expectedKForOutcome) / Math.max(state.kConstant, expectedKForOutcome);

    if (kDeviation > 0.1) { // Allow 10% deviation
      setAmmError(`AMM needs rebalancing: k_constant (${state.kConstant.toFixed(2)}) should be close to reserve * shares (${expectedKForOutcome.toFixed(2)})`);
      return false;
    }

    setAmmError('');
    return true;
  }

  const loadUserShares = async () => {
    if (!user || !outcomeId) {
      addDebugLog('Skipping user shares load: no user or outcome')
      return
    }

    try {
      addDebugLog(`Loading shares for user: ${user.id.substring(0, 8)}...`)
      
      const { data: position, error } = await supabase
        .from('positions')
        .select('shares_owned')
        .eq('user_id', user.id)
        .eq('market_id', market.id)
        .eq('outcome_id', outcomeId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          addDebugLog('No existing position found')
          setUserShares(0)
        } else {
          addDebugLog(`Position query error: ${error.message}`)
          console.error('Error loading user shares:', error)
        }
      } else {
        const shares = safeNumber(position.shares_owned || 0, 'shares_owned')
        addDebugLog(`Found ${shares} shares`)
        setUserShares(shares)
      }
    } catch (error: any) {
      console.error('Error loading user shares:', error)
      addDebugLog(`Shares load error: ${error.message}`)
      setUserShares(0)
    }
  }

  const loadPendingOrders = async () => {
    if (!outcomeId) {
      addDebugLog('Skipping pending orders load: no outcome')
      return
    }

    try {
      addDebugLog('Loading pending orders from order book...')
      
      const { data, error } = await supabase
        .from('trade_orders')
        .select('id, order_side, shares, executed_shares, price_limit, created_at')
        .eq('outcome_id', outcomeId)
        .eq('order_status', 'pending')
        .order('price_limit', { ascending: false })
        .limit(20)

      if (error) {
        addDebugLog(`Pending orders query error: ${error.message}`)
        console.error('Error loading pending orders:', error)
      } else {
        setPendingOrders(data || [])
        addDebugLog(`Loaded ${data?.length || 0} pending orders`)
      }
    } catch (error: any) {
      console.error('Error loading pending orders:', error)
      addDebugLog(`Pending orders load error: ${error.message}`)
      setPendingOrders([])
    }
  }

  const calculateTradeEstimation = () => {
    if (!selectedOutcome || !marketState || !amount) {
      addDebugLog('Skipping estimation: missing data')
      resetEstimations()
      return
    }

    try {
      const numericAmount = parseFloat(amount)
      if (isNaN(numericAmount) || numericAmount <= 0) {
        addDebugLog('Invalid amount for estimation')
        resetEstimations()
        return
      }

      // Don't calculate estimation if AMM state is invalid
      if (ammError) {
        addDebugLog('Skipping estimation: AMM state invalid')
        resetEstimations()
        return
      }

      addDebugLog(`Calculating ${orderType} estimation for: $${numericAmount}`)

      if (orderType === 'buy') {
        const estimation = amm.estimateTrade(
          marketState,
          selectedOutcome.id,
          'buy',
          numericAmount
        )

        const shares = safeNumber(estimation.sharesReceived || 0, 'shares')
        // const fees = safeNumber(estimation.fees || numericAmount * 0.03, 'fees')
        const fees = safeNumber(estimation.fees || numericAmount * 0.00, 'fees')
        const impact = safeNumber(estimation.priceImpact || 0, 'price_impact')

        addDebugLog(`Buy estimation: ${shares} shares, $${fees} fees, ${impact}% impact`)

        setEstimatedShares(shares)
        setEstimatedCost(safeNumber(numericAmount, 'total_amount'))
        setPriceImpact(impact)
        setPlatformFee(fees)
      } else {
        const estimation = amm.estimateTrade(
          marketState,
          selectedOutcome.id,
          'sell',
          numericAmount
        )

        const cost = safeNumber(estimation.totalCost || 0, 'executed_amount')
        // const fees = safeNumber(estimation.fees || (estimation.totalCost || 0) * 0.00, 'fees')
        const fees = safeNumber(estimation.fees || (estimation.totalCost || 0) * 0.03, 'fees')
        const impact = safeNumber(estimation.priceImpact || 0, 'price_impact')

        addDebugLog(`Sell estimation: $${cost} payout, $${fees} fees, ${impact}% impact`)

        setEstimatedShares(safeNumber(numericAmount, 'shares'))
        setEstimatedCost(cost)
        setPriceImpact(impact)
        setPlatformFee(fees)
      }
    } catch (error: any) {
      console.error('Error calculating trade estimation:', error)
      addDebugLog(`Estimation error: ${error.message}`)
      resetEstimations()
    }
  }

  const resetEstimations = () => {
    setEstimatedShares(0)
    setEstimatedCost(0)
    setPriceImpact(0)
    setPlatformFee(0)
  }

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  
  addDebugLog('=== TRADE EXECUTION STARTED ===')
  
  if (!user) {
    addDebugLog('❌ No user found')
    alert('Please log in to trade')
    return
  }

  if (!selectedOutcome) {
    addDebugLog('❌ No outcome selected')
    return
  }

  if (!amount) {
    addDebugLog('❌ No amount specified')
    return
  }

  if (!marketState) {
    addDebugLog('❌ Market state not loaded')
    return
  }

  setIsLoading(true)
  setOrderStatus('pending')

  try {
    const numericAmount = parseFloat(amount)
    addDebugLog(`Processing ${orderType} order for: ${orderType === 'buy' ? '$' : ''}${numericAmount}${orderType === 'sell' ? ' shares' : ''}`)

    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new Error('Invalid amount')
    }

    // Validate user balance/shares
    if (orderType === 'buy') {
      const totalCost = numericAmount * 1.03
      if (profile && totalCost > profile.balance) {
        throw new Error(`Insufficient balance. Need: $${totalCost.toFixed(2)}, Have: $${profile.balance}`)
      }
    }

    if (orderType === 'sell' && numericAmount > userShares) {
      throw new Error(`Insufficient shares. Need: ${numericAmount}, Have: ${userShares}`)
    }

    addDebugLog('✅ Pre-trade validation passed')

    // ========================================
    // BUY ORDER EXECUTION
    // ========================================
    
    if (orderType === 'buy') {
      addDebugLog('Executing BUY order...')
      
      let amountRemaining = numericAmount
      let sharesFromOrders = 0
      let sharesFromAMM = 0
      let totalFees = 0
      const matchedOrders: any[] = []
      
      // ========================================
      // STEP 1: MATCH WITH SELL ORDERS
      // ========================================
      
      addDebugLog('Step 1: Checking order book for sell orders...')
      
      // Get pending sell orders sorted by price (lowest first)
      const { data: sellOrders, error: ordersError } = await supabase
        .from('trade_orders')
        .select('*')
        .eq('outcome_id', selectedOutcome.id)
        .eq('order_side', 'sell')
        .eq('order_status', 'pending')
        .order('price_limit', { ascending: true }) // Best price first
        .limit(10)
      
      if (ordersError) throw new Error(`Failed to fetch orders: ${ordersError.message}`)
      
      addDebugLog(`Found ${sellOrders?.length || 0} sell orders`)
      
      if (sellOrders && sellOrders.length > 0) {
        for (const sellOrder of sellOrders) {
          if (amountRemaining <= 0.01) break
          
          const remainingShares = sellOrder.shares - (sellOrder.executed_shares || 0)
          const orderPrice = sellOrder.price_limit
          const maxSharesCanBuy = amountRemaining / orderPrice
          const sharesToMatch = Math.min(remainingShares, maxSharesCanBuy)
          const costForShares = sharesToMatch * orderPrice
          // const matchFee = costForShares * 0.03
          const matchFee = costForShares * 0.00
          
          if (costForShares + matchFee <= amountRemaining) {
            addDebugLog(`Matching ${sharesToMatch.toFixed(2)} shares @ $${orderPrice.toFixed(4)} from order ${sellOrder.id.substring(0, 8)}`)
            
            // Update the sell order
            const newExecutedShares = (sellOrder.executed_shares || 0) + sharesToMatch
            const newExecutedAmount = (sellOrder.executed_amount || 0) + costForShares
            const newStatus = newExecutedShares >= sellOrder.shares ? 'filled' : 'partial'
            
            await supabase
              .from('trade_orders')
              .update({
                executed_shares: safeNumber(newExecutedShares, 'executed_shares'),
                executed_amount: safeNumber(newExecutedAmount, 'executed_amount'),
                order_status: newStatus,
                filled_at: newStatus === 'filled' ? new Date().toISOString() : null,
                updated_at: new Date().toISOString()
              })
              .eq('id', sellOrder.id)
            
            // Get seller's current balance and update
            const { data: sellerProfile } = await supabase
              .from('profiles')
              .select('balance')
              .eq('id', sellOrder.user_id)
              .single()
            
            if (sellerProfile) {
              await supabase
                .from('profiles')
                .update({
                  balance: safeNumber(sellerProfile.balance + costForShares, 'balance')
                })
                .eq('id', sellOrder.user_id)
            }
            
            // Update seller's position
            const { data: sellerPosition } = await supabase
              .from('positions')
              .select('*')
              .eq('user_id', sellOrder.user_id)
              .eq('outcome_id', selectedOutcome.id)
              .single()
            
            if (sellerPosition) {
              const newSharesOwned = sellerPosition.shares_owned - sharesToMatch
              const newCurrentValue = newSharesOwned * sellerPosition.current_price
              const pnlFromTrade = costForShares - (sellerPosition.avg_buy_price * sharesToMatch)
              const newRealizedPnl = (sellerPosition.realized_pnl || 0) + pnlFromTrade
              
              await supabase
                .from('positions')
                .update({
                  shares_owned: safeNumber(newSharesOwned, 'shares_owned'),
                  current_value: safeNumber(newCurrentValue, 'current_value'),
                  realized_pnl: safeNumber(newRealizedPnl, 'realized_pnl'),
                  is_active: newSharesOwned > 0,
                  updated_at: new Date().toISOString()
                })
                .eq('id', sellerPosition.id)
            }
            
            sharesFromOrders += sharesToMatch
            amountRemaining -= (costForShares + matchFee)
            totalFees += matchFee
            
            matchedOrders.push({
              orderId: sellOrder.id,
              shares: sharesToMatch,
              price: orderPrice,
              amount: costForShares
            })
            
            addDebugLog(`✅ Matched! Remaining budget: $${amountRemaining.toFixed(2)}`)
          }
        }
      }
      
      // ========================================
      // STEP 2: USE AMM FOR REMAINING AMOUNT
      // ========================================
      
      let newPrice = selectedOutcome.current_price
      
      if (amountRemaining > 0.01) {
        addDebugLog(`Step 2: Using AMM for remaining $${amountRemaining.toFixed(2)}`)
        
        const ammFee = amountRemaining * 0.00
        // const ammFee = amountRemaining * 0.03
        const amountAfterFees = amountRemaining - ammFee
        
        const currentOutcome = marketState.outcomes[selectedOutcome.id]
        const currentReserve = currentOutcome.reserve
        const currentShares = currentOutcome.shares
        const k = currentReserve
        
        // Calculate new state AFTER adding liquidity
        const newReserve = currentReserve + amountAfterFees
        const ratio = k / newReserve
        
        if (ratio >= 1) {
          if (sharesFromOrders > 0) {
            addDebugLog(`⚠️ AMM capacity reached, proceeding with ${sharesFromOrders} shares from order book`)
            amountRemaining = 0
          } else {
            throw new Error(`Trade too large. Try amount less than $${(currentReserve * 0.5).toFixed(2)}`)
          }
        } else {
          // Calculate shares received
          sharesFromAMM = currentReserve * (1 - ratio)
          
          // CRITICAL: Price goes UP because reserve increases while shares decrease
          const newTotalShares = currentShares - sharesFromAMM
          newPrice = newReserve / newTotalShares
          
          addDebugLog(`AMM: ${sharesFromAMM.toFixed(2)} shares @ $${newPrice.toFixed(4)} (price UP from $${currentOutcome.currentPrice.toFixed(4)})`)
          
          // Update market outcome with NEW HIGHER PRICE
          const { error: outcomeError } = await supabase
            .from('market_outcomes')
            .update({
              reserve: safeNumber(newReserve, 'reserve'),
              total_shares: safeNumber(newTotalShares, 'total_shares'),
              current_price: safeNumber(newPrice, 'current_price'),
              volume_24h: safeNumber((selectedOutcome.volume_24h || 0) + amountRemaining, 'total_amount'),
              updated_at: new Date().toISOString()
            })
            .eq('id', selectedOutcome.id)
          
          if (outcomeError) throw new Error(`Failed to update market: ${outcomeError.message}`)
          
          totalFees += ammFee
          amountRemaining = 0
          
          addDebugLog('✅ AMM execution complete')
        }
      }
      
      const totalShares = sharesFromOrders + sharesFromAMM
      const totalSpent = numericAmount
      const avgPrice = totalSpent / totalShares
      
      addDebugLog(`Total: ${totalShares.toFixed(2)} shares (${sharesFromOrders.toFixed(2)} orders + ${sharesFromAMM.toFixed(2)} AMM)`)
      
      // ========================================
      // STEP 3: UPDATE BUYER'S DATA
      // ========================================
      
      // Update buyer's balance
      await supabase
        .from('profiles')
        .update({
          balance: safeNumber((profile?.balance || 0) - totalSpent, 'balance'),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
      
      // Update or create buyer's position
      const { data: existingPosition } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', user.id)
        .eq('market_id', market.id)
        .eq('outcome_id', selectedOutcome.id)
        .single()
      
      if (existingPosition) {
        const newSharesOwned = existingPosition.shares_owned + totalShares
        const newTotalInvested = existingPosition.total_invested + totalSpent
        const newAvgPrice = newTotalInvested / newSharesOwned
        const newCurrentValue = newSharesOwned * newPrice
        const newTotalFeesPaid = (existingPosition.total_fees_paid || 0) + totalFees
        
        await supabase
          .from('positions')
          .update({
            shares_owned: safeNumber(newSharesOwned, 'shares_owned'),
            avg_buy_price: safeNumber(newAvgPrice, 'avg_buy_price'),
            total_invested: safeNumber(newTotalInvested, 'total_invested'),
            current_price: safeNumber(newPrice, 'current_price'),
            current_value: safeNumber(newCurrentValue, 'current_value'),
            total_fees_paid: safeNumber(newTotalFeesPaid, 'total_fees'),
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPosition.id)
      } else {
        await supabase
          .from('positions')
          .insert({
            user_id: user.id,
            market_id: market.id,
            outcome_id: selectedOutcome.id,
            shares_owned: safeNumber(totalShares, 'shares_owned'),
            avg_buy_price: safeNumber(avgPrice, 'avg_buy_price'),
            total_invested: safeNumber(totalSpent, 'total_invested'),
            current_price: safeNumber(newPrice, 'current_price'),
            current_value: safeNumber(totalShares * newPrice, 'current_value'),
            total_fees_paid: safeNumber(totalFees, 'total_fees'),
            is_active: true
          })
      }
      
      // Create order record
      const { data: orderData, error: orderError } = await supabase
        .from('trade_orders')
        .insert({
          user_id: user.id,
          market_id: market.id,
          outcome_id: selectedOutcome.id,
          order_type: 'market',
          order_side: 'buy',
          order_status: 'filled',
          shares: safeNumber(totalShares, 'shares'),
          total_amount: safeNumber(totalSpent, 'total_amount'),
          executed_shares: safeNumber(totalShares, 'shares'),
          executed_price: safeNumber(avgPrice, 'executed_price'),
          executed_amount: safeNumber(totalSpent, 'executed_amount'),
          filled_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (orderError) throw new Error(`Failed to create order: ${orderError.message}`)
      
      // Create transaction
      await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          market_id: market.id,
          outcome_id: selectedOutcome.id,
          order_id: orderData.id,
          transaction_type: 'buy',
          shares: safeNumber(totalShares, 'shares'),
          price_per_share: safeNumber(avgPrice, 'current_price'),
          total_amount: safeNumber(totalSpent, 'total_amount'),
          platform_fee: safeNumber(totalFees, 'platform_fee'),
          total_fees: safeNumber(totalFees, 'total_fees'),
          balance_change: safeNumber(-totalSpent, 'balance')
        })
      
      // Update liquidity pool
      const { data: poolData } = await supabase
        .from('liquidity_pools')
        .select('total_fees_collected, daily_volume')
        .eq('market_id', market.id)
        .single()
      
      if (poolData) {
        await supabase
          .from('liquidity_pools')
          .update({
            total_fees_collected: safeNumber((poolData.total_fees_collected || 0) + totalFees, 'total_fees'),
            daily_volume: safeNumber((poolData.daily_volume || 0) + totalSpent, 'total_amount'),
            updated_at: new Date().toISOString()
          })
          .eq('market_id', market.id)
      }
      
      setOrderStatus('filled')
      
      // Refresh data
      await refreshProfile()
      await loadMarketState()
      await loadUserShares()
      await loadPendingOrders()
      
      setTimeout(() => {
        alert(
          `Buy order executed!\n\n` +
          `• Total shares: ${totalShares.toFixed(2)}\n` +
          `• From order book: ${sharesFromOrders.toFixed(2)}\n` +
          `• From AMM: ${sharesFromAMM.toFixed(2)}\n` +
          `• Average price: $${avgPrice.toFixed(4)}\n` +
          `• New market price: $${newPrice.toFixed(4)}\n` +
          `• Total cost: $${totalSpent.toFixed(2)}\n` +
          `• Fees: $${totalFees.toFixed(2)}`
        )
        onClose()
        setAmount('')
        setOrderStatus('ready')
      }, 500)
      
    } else {
      // ========================================
      // SELL ORDER EXECUTION
      // ========================================
      
      addDebugLog('Executing SELL order...')
      
      const sharesToSell = numericAmount
      let sharesMatched = 0
      let amountReceived = 0
      let totalFees = 0
      
      // Try to match with buy orders first
      const { data: buyOrders } = await supabase
        .from('trade_orders')
        .select('*')
        .eq('outcome_id', selectedOutcome.id)
        .eq('order_side', 'buy')
        .eq('order_status', 'pending')
        .order('price_limit', { ascending: false }) // Highest price first
        .limit(10)
      
      addDebugLog(`Found ${buyOrders?.length || 0} buy orders`)
      
      if (buyOrders && buyOrders.length > 0) {
        for (const buyOrder of buyOrders) {
          if (sharesMatched >= sharesToSell) break
          
          const remainingShares = buyOrder.shares - (buyOrder.executed_shares || 0)
          const sharesToMatch = Math.min(remainingShares, sharesToSell - sharesMatched)
          const orderPrice = buyOrder.price_limit
          const proceeds = sharesToMatch * orderPrice
          // const matchFee = proceeds * 0.03
          const matchFee = proceeds * 0.00
          
          addDebugLog(`Matching ${sharesToMatch.toFixed(2)} shares @ $${orderPrice.toFixed(4)}`)
          
          // Update buy order
          const newExecutedShares = (buyOrder.executed_shares || 0) + sharesToMatch
          const newExecutedAmount = (buyOrder.executed_amount || 0) + proceeds
          const newStatus = newExecutedShares >= buyOrder.shares ? 'filled' : 'partial'
          
          await supabase
            .from('trade_orders')
            .update({
              executed_shares: safeNumber(newExecutedShares, 'executed_shares'),
              executed_amount: safeNumber(newExecutedAmount, 'executed_amount'),
              order_status: newStatus,
              filled_at: newStatus === 'filled' ? new Date().toISOString() : null,
              updated_at: new Date().toISOString()
            })
            .eq('id', buyOrder.id)
          
          // Get buyer's balance and deduct
          const { data: buyerProfile } = await supabase
            .from('profiles')
            .select('balance')
            .eq('id', buyOrder.user_id)
            .single()
          
          if (buyerProfile) {
            await supabase
              .from('profiles')
              .update({
                balance: safeNumber(buyerProfile.balance - (proceeds + matchFee), 'balance')
              })
              .eq('id', buyOrder.user_id)
          }
          
          // Update buyer's position
          const { data: buyerPosition } = await supabase
            .from('positions')
            .select('*')
            .eq('user_id', buyOrder.user_id)
            .eq('market_id', market.id)
            .eq('outcome_id', selectedOutcome.id)
            .single()
          
          if (buyerPosition) {
            const newSharesOwned = buyerPosition.shares_owned + sharesToMatch
            const newTotalInvested = buyerPosition.total_invested + proceeds
            const newAvgPrice = newTotalInvested / newSharesOwned
            const newCurrentValue = newSharesOwned * selectedOutcome.current_price
            
            await supabase
              .from('positions')
              .update({
                shares_owned: safeNumber(newSharesOwned, 'shares_owned'),
                avg_buy_price: safeNumber(newAvgPrice, 'avg_buy_price'),
                total_invested: safeNumber(newTotalInvested, 'total_invested'),
                current_value: safeNumber(newCurrentValue, 'current_value'),
                total_fees_paid: safeNumber((buyerPosition.total_fees_paid || 0) + matchFee, 'total_fees'),
                is_active: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', buyerPosition.id)
          } else {
            // Create new position for buyer
            await supabase
              .from('positions')
              .insert({
                user_id: buyOrder.user_id,
                market_id: market.id,
                outcome_id: selectedOutcome.id,
                shares_owned: safeNumber(sharesToMatch, 'shares_owned'),
                avg_buy_price: safeNumber(orderPrice, 'avg_buy_price'),
                total_invested: safeNumber(proceeds, 'total_invested'),
                current_price: safeNumber(selectedOutcome.current_price, 'current_price'),
                current_value: safeNumber(sharesToMatch * selectedOutcome.current_price, 'current_value'),
                total_fees_paid: safeNumber(matchFee, 'total_fees'),
                is_active: true
              })
          }
          
          sharesMatched += sharesToMatch
          amountReceived += (proceeds - matchFee)
          totalFees += matchFee
        }
      }
      
      const sharesRemaining = sharesToSell - sharesMatched
      
      if (sharesRemaining > 0.01) {
        // Create pending sell order for unmatched shares
        addDebugLog(`Creating sell order for ${sharesRemaining.toFixed(2)} unmatched shares`)
        
        await supabase
          .from('trade_orders')
          .insert({
            user_id: user.id,
            market_id: market.id,
            outcome_id: selectedOutcome.id,
            order_type: 'limit',
            order_side: 'sell',
            order_status: 'pending',
            shares: safeNumber(sharesRemaining, 'shares'),
            price_limit: safeNumber(selectedOutcome.current_price, 'price_limit'),
            executed_shares: safeNumber(sharesMatched, 'shares'),
            executed_amount: safeNumber(amountReceived, 'executed_amount')
          })
        
        setOrderStatus('partial')
      } else {
        setOrderStatus('filled')
      }
      
      // Update seller's position (deduct ALL shares immediately)
      const { data: sellerPosition } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', user.id)
        .eq('outcome_id', selectedOutcome.id)
        .single()
      
      if (sellerPosition) {
        const newSharesOwned = sellerPosition.shares_owned - sharesToSell
        const newCurrentValue = newSharesOwned * sellerPosition.current_price
        const pnlFromMatched = amountReceived - (sellerPosition.avg_buy_price * sharesMatched)
        const newRealizedPnl = (sellerPosition.realized_pnl || 0) + pnlFromMatched
        
        await supabase
          .from('positions')
          .update({
            shares_owned: safeNumber(newSharesOwned, 'shares_owned'),
            current_value: safeNumber(newCurrentValue, 'current_value'),
            realized_pnl: safeNumber(newRealizedPnl, 'realized_pnl'),
            is_active: newSharesOwned > 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', sellerPosition.id)
      }
      
      // Credit seller for matched portion only
      if (sharesMatched > 0) {
        await supabase
          .from('profiles')
          .update({
            balance: safeNumber((profile?.balance || 0) + amountReceived, 'balance')
          })
          .eq('id', user.id)
      }
      
      await refreshProfile()
      await loadMarketState()
      await loadUserShares()
      await loadPendingOrders()
      
      setTimeout(() => {
        if (sharesRemaining > 0) {
          alert(
            `Sell order partially filled!\n\n` +
            `• Shares sold: ${sharesMatched.toFixed(2)}\n` +
            `• Amount received: $${amountReceived.toFixed(2)}\n` +
            `• Pending: ${sharesRemaining.toFixed(2)} shares\n` +
            `• Your order will fill when buyers match`
          )
        } else {
          alert(
            `Sell order executed!\n\n` +
            `• Shares sold: ${sharesToSell.toFixed(2)}\n` +
            `• Amount received: $${amountReceived.toFixed(2)}\n` +
            `• Fees: $${totalFees.toFixed(2)}`
          )
        }
        onClose()
        setAmount('')
        setOrderStatus('ready')
      }, 500)
    }
    
    addDebugLog('=== TRADE EXECUTION COMPLETED ===')

  } catch (error: any) {
    console.error('Trade execution error:', error)
    addDebugLog(`❌ Trade failed: ${error.message}`)
    setOrderStatus('rejected')
    alert(`Trade failed: ${error.message}`)
  } finally {
    setIsLoading(false)
  }
}

  // Function to test database connection
  const testDatabaseConnection = async () => {
    addDebugLog('Testing database connection...')
    
    try {
      const { data, error } = await supabase
        .from('trade_orders')
        .select('count')
        .limit(1)

      if (error) {
        addDebugLog(`❌ Database connection failed: ${error.message}`)
      } else {
        addDebugLog('✅ Database connection successful')
      }
    } catch (error: any) {
      addDebugLog(`❌ Database test error: ${error.message}`)
    }
  }

  // Test number formatting
  const testNumberFormatting = () => {
    addDebugLog('Testing number formatting against database precision...')
    
    const testCases = [
      { value: 123.4567890123, column: 'shares', expected: 8 },
      { value: 123.456789, column: 'total_amount', expected: 2 },
      { value: 0.123456789, column: 'price_limit', expected: 6 },
      { value: 1000000.12345678, column: 'shares', expected: 8 },
      { value: 99999999.99999999, column: 'shares', expected: 8 },
    ];
    
    testCases.forEach(test => {
      const result = safeNumber(test.value, test.column);
      const decimalPlaces = (result.toString().split('.')[1] || '').length;
      const passed = decimalPlaces <= test.expected;
      addDebugLog(`${passed ? '✅' : '❌'} ${test.column}: ${test.value} → ${result} (${decimalPlaces} decimals, max: ${test.expected})`);
    });
  }

  const totalAmount = orderType === 'buy' 
    ? estimatedCost + platformFee
    : estimatedCost - platformFee

  const isInsufficientBalance = orderType === 'buy' && profile && (parseFloat(amount || '0') + (parseFloat(amount || '0') * 0.00)) > profile.balance
  // const isInsufficientBalance = orderType === 'buy' && profile && (parseFloat(amount || '0') + (parseFloat(amount || '0') * 0.03)) > profile.balance
  const isInsufficientShares = orderType === 'sell' && parseFloat(amount || '0') > userShares

  const getStatusMessage = () => {
    switch (orderStatus) {
      case 'pending':
        return 'Processing your order...'
      case 'filled':
        return 'Order filled successfully!'
      case 'partial':
        return 'Order partially filled - remaining shares in order book'
      case 'rejected':
        return 'Order failed'
      default:
        return ''
    }
  }

  const getStatusColor = () => {
    switch (orderStatus) {
      case 'pending':
        return 'text-blue-600'
      case 'filled':
        return 'text-green-600'
      case 'partial':
        return 'text-yellow-600'
      case 'rejected':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  // Separate pending orders into buy and sell
  const pendingBuyOrders = pendingOrders.filter(order => order.order_side === 'buy')
  const pendingSellOrders = pendingOrders.filter(order => order.order_side === 'sell')

  if (!isOpen || !selectedOutcome) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {orderType === 'buy' ? 'Buy' : 'Sell'} Shares
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              {market.team_a.name} vs {market.team_b.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isLoading}
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Debug Panel */}

          {/* AMM Configuration Warning */}
          {ammError && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <FiAlertTriangle className="text-orange-500 mr-2" />
                  <span className="text-orange-800 font-medium">
                    Market Configuration Issue
                  </span>
                </div>
                <button
                  type="button"
                  onClick={fixAmmConfiguration}
                  disabled={isLoading}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50 flex items-center"
                >
                  <FiRefreshCw className="mr-1" size={12} />
                  Fix Now
                </button>
              </div>
              <p className="text-orange-700 text-sm mt-2">
                {ammError} This market needs to be rebalanced before trading can continue.
              </p>
            </div>
          )}

          {/* Order Status */}
          {orderStatus !== 'ready' && (
            <div className={`p-4 rounded-lg border ${
              orderStatus === 'filled' ? 'bg-green-50 border-green-200' :
              orderStatus === 'partial' ? 'bg-yellow-50 border-yellow-200' :
              orderStatus === 'rejected' ? 'bg-red-50 border-red-200' :
              'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`font-medium ${getStatusColor()}`}>
                  {getStatusMessage()}
                </span>
                {orderStatus === 'pending' && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                )}
              </div>
              {estimatedWait && (
                <div className="flex items-center text-sm text-blue-600 mt-1">
                  <FiClock className="mr-1" size={14} />
                  Estimated wait: {Math.floor(estimatedWait / 60)}min {estimatedWait % 60}sec
                </div>
              )}
            </div>
          )}

          {/* Outcome Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-900">
                {selectedOutcome.outcome_name}
              </span>
              <span className="text-2xl font-bold text-blue-600">
                ${selectedOutcome.current_price.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Order Book Preview */}
          {pendingOrders.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                <FiInfo className="mr-2" />
                Active Order Book ({pendingOrders.length} orders)
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Sell Orders */}
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2">SELL ORDERS</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {pendingSellOrders.slice(0, 5).map((order) => (
                      <div key={order.id} className="flex justify-between text-xs bg-red-50 p-2 rounded">
                        <span className="text-gray-600">
                          {(order.shares - order.executed_shares).toFixed(2)}
                        </span>
                        <span className="font-medium text-red-600">
                          ${order.price_limit?.toFixed(4)}
                        </span>
                      </div>
                    ))}
                    {pendingSellOrders.length === 0 && (
                      <div className="text-xs text-gray-400 text-center py-2">No sell orders</div>
                    )}
                  </div>
                </div>

                {/* Buy Orders */}
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2">BUY ORDERS</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {pendingBuyOrders.slice(0, 5).map((order) => (
                      <div key={order.id} className="flex justify-between text-xs bg-green-50 p-2 rounded">
                        <span className="font-medium text-green-600">
                          ${order.price_limit?.toFixed(4)}
                        </span>
                        <span className="text-gray-600">
                          {(order.shares - order.executed_shares).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    {pendingBuyOrders.length === 0 && (
                      <div className="text-xs text-gray-400 text-center py-2">No buy orders</div>
                    )}
                  </div>
                </div>
              </div>

              {(pendingSellOrders.length > 5 || pendingBuyOrders.length > 5) && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  View more orders in the market details
                </p>
              )}
            </div>
          )}

          {/* Order Type Toggle */}
          <div className="flex border border-gray-300 rounded-lg p-1">
            <button
              type="button"
              onClick={() => {
                setOrderType('buy')
                setAmount('')
                setOrderStatus('ready')
                addDebugLog('Switched to BUY mode')
              }}
              disabled={isLoading}
              className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-colors ${
                orderType === 'buy'
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'text-gray-600 hover:text-gray-800 disabled:opacity-50'
              }`}
            >
              <FiTrendingUp className="inline mr-2" />
              Buy
            </button>
            <button
              type="button"
              onClick={() => {
                setOrderType('sell')
                setAmount('')
                setOrderStatus('ready')
                addDebugLog('Switched to SELL mode')
              }}
              disabled={isLoading}
              className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-colors ${
                orderType === 'sell'
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'text-gray-600 hover:text-gray-800 disabled:opacity-50'
              }`}
            >
              <FiTrendingDown className="inline mr-2" />
              Sell
            </button>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {orderType === 'buy' ? 'Amount to Spend ($)' : 'Shares to Sell'}
            </label>
            <div className="relative">
              {orderType === 'buy' && (
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiDollarSign className="h-5 w-5 text-gray-400" />
                </div>
              )}
              <input
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  addDebugLog(`Amount changed to: ${e.target.value}`)
                }}
                className={`${orderType === 'buy' ? 'pl-10' : 'pl-4'} pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full disabled:opacity-50`}
                placeholder={orderType === 'buy' ? "0.00" : "0"}
                min="0"
                step={orderType === 'buy' ? "0.01" : "0.01"}
                required
                disabled={isLoading || !!ammError}
              />
            </div>
            {orderType === 'buy' && (
              <div className="text-xs text-gray-500 mt-1">
                {/* Includes 0% platform fee. Total cost: ${(parseFloat(amount || '0') * 1.03).toFixed(2)} */}
                Includes 0% platform fee. Total cost: ${(parseFloat(amount || '0') * 1.00).toFixed(2)}
              </div>
            )}
            {orderType === 'sell' && pendingSellOrders.length > 0 && (
              <div className="text-xs text-yellow-600 mt-1">
                ⚠️ If no buyers match, your order will be added to the order book
              </div>
            )}
          </div>

          {/* Error Messages */}
          {(isInsufficientBalance || isInsufficientShares) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <FiAlertTriangle className="text-red-500 mr-2" />
                <span className="text-red-700 text-sm font-medium">
                  {isInsufficientBalance && 'Insufficient balance (including fees)'}
                  {isInsufficientShares && 'Insufficient shares'}
                </span>
              </div>
            </div>
          )}

          {/* Trade Details */}
          {amount && parseFloat(amount) > 0 && !ammError && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                <FiInfo className="mr-2" />
                Trade Estimation {orderType === 'sell' && '(if matched with buyers)'}
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700">
                    {orderType === 'buy' ? 'Estimated Shares:' : 'Estimated Payout:'}
                  </span>
                  <span className="font-medium">
                    {orderType === 'buy' 
                      ? `${estimatedShares.toFixed(2)} shares`
                      : `$${estimatedCost.toFixed(2)}`
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Effective Price:</span>
                  <span className="font-medium">
                    ${estimatedShares > 0 ? (orderType === 'buy' ? estimatedCost / estimatedShares : estimatedCost / estimatedShares).toFixed(4) : '0.0000'}/share
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Price Impact:</span>
                  <span className="font-medium">{priceImpact.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  {/* <span className="text-blue-700">Platform Fee (3%):</span> */}
                  <span className="text-blue-700">Platform Fee (0%):</span>
                  <span className="font-medium">${platformFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-blue-200 pt-2">
                  <span className="text-blue-900 font-medium">
                    {orderType === 'buy' ? 'Total Cost:' : 'Total Receive:'}
                  </span>
                  <span className="font-bold text-blue-900">
                    ${totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
              {orderType === 'buy' && pendingSellOrders.length > 0 && (
                <div className="mt-3 text-xs text-blue-700 bg-blue-100 p-2 rounded">
                  💡 Your order will first match with {pendingSellOrders.length} pending sell order{pendingSellOrders.length !== 1 ? 's' : ''}, then AMM if needed
                </div>
              )}
            </div>
          )}

          {/* User Info */}
          <div className="text-sm text-gray-600 space-y-1">
            <div>
              Available Balance: <span className="font-medium">${profile?.balance?.toFixed(2) || '0.00'}</span>
            </div>
            {orderType === 'sell' && (
              <div>
                Your Shares: <span className="font-medium">{userShares.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !amount || parseFloat(amount) <= 0 || isInsufficientBalance || isInsufficientShares || orderStatus === 'pending' || !!ammError}
            className={`w-full py-3 px-4 rounded-lg font-semibold focus:ring-2 focus:ring-offset-2 transition-colors ${
              orderType === 'buy'
                ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500 text-white'
                : 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {orderStatus === 'pending' ? 'Processing...' : 'Executing...'}
              </div>
            ) : ammError ? (
              'Fix Market Configuration First'
            ) : (
              `Confirm ${orderType === 'buy' ? 'Buy' : 'Sell'} Order`
            )}
          </button>

          {/* AMM Info */}
          <div className="text-xs text-gray-500 text-center">
            Hybrid Order Book + AMM • {pendingOrders.length} active orders • Real-time price discovery
          </div>
        </form>
      </div>
    </div>
  )
}
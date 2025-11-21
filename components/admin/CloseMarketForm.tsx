'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { FiCheck, FiX, FiAlertCircle, FiClock, FiTrendingUp, FiDollarSign, FiRefreshCw, FiPlay, FiPause } from 'react-icons/fi'

interface Market {
  id: string
  espn_id?: string
  match_date: string
  status: string
  team_a_score: number
  team_b_score: number
  sport?: { name: string }
  team_a_id: string
  team_b_id: string
  team_a?: { 
    name: string; 
    logo_url?: string; 
    short_name: string;
    id: string;
  }
  team_b?: { 
    name: string; 
    logo_url?: string; 
    short_name: string;
    id: string;
  }
  market_outcomes: Array<{
    id: string
    outcome_name: string
    outcome_type: string
    total_shares: number
    current_price: number
    reserve: number
  }>
}

interface CloseMarketFormProps {
  markets: Market[]
  setMarkets?: (markets: Market[]) => void
}

interface LiveScoreData {
  homeScore: number
  awayScore: number
  status: string
  period: number
  clock: string
  completed: boolean
  detail: string
}

// Simple hook for fetching live scores without WebSocket
function useLiveScore(espnId?: string) {
  const [scoreData, setScoreData] = useState<LiveScoreData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchScore = async () => {
    if (!espnId) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/espn/game/${espnId}`)
      if (response.ok) {
        const data = await response.json()
        setScoreData(data)
      } else {
        setError('Failed to fetch score')
      }
    } catch (err) {
      setError('Error fetching live score')
      console.error('Error fetching live score:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (espnId) {
      fetchScore()
    }
  }, [espnId])

  return {
    scoreData,
    isLoading,
    error,
    refetch: fetchScore
  }
}

// Team display component
const TeamDisplay = ({ 
  team, 
  score, 
  isHome = false 
}: { 
  team: Market['team_a']; 
  score: number; 
  isHome?: boolean 
}) => {
  if (!team) return null

  return (
    <div className={`flex items-center space-x-3 ${isHome ? 'justify-start' : 'justify-end'} flex-1`}>
      {isHome && (
        <>
          {team.logo_url ? (
            <img 
              src={team.logo_url} 
              alt={team.name}
              className="w-8 h-8 rounded-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
              {team.short_name?.substring(0, 2) || team.name.substring(0, 2)}
            </div>
          )}
          <div className="text-left">
            <div className="font-medium text-gray-900">{team.name}</div>
            <div className="text-sm text-gray-500">{team.short_name}</div>
          </div>
        </>
      )}
      
      <div className="font-mono font-bold text-lg text-gray-900 min-w-8 text-center">
        {score}
      </div>

      {!isHome && (
        <>
          <div className="text-right">
            <div className="font-medium text-gray-900">{team.name}</div>
            <div className="text-sm text-gray-500">{team.short_name}</div>
          </div>
          {team.logo_url ? (
            <img 
              src={team.logo_url} 
              alt={team.name}
              className="w-8 h-8 rounded-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
              {team.short_name?.substring(0, 2) || team.name.substring(0, 2)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function CloseMarketForm({ markets: initialMarkets, setMarkets }: CloseMarketFormProps) {
  const [markets, setLocalMarkets] = useState<Market[]>(initialMarkets)
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null)
  const [selectedOutcome, setSelectedOutcome] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [settlementResult, setSettlementResult] = useState<any>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'live' | 'closed' | 'ready'>('ready')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  // Use the simple live score hook for the selected market
  const { scoreData: liveScore, isLoading: scoreLoading, refetch: refetchScore } = useLiveScore(selectedMarket?.espn_id)

  // Filter markets based on status
  const filteredMarkets = markets.filter(m => {
    if (filterStatus === 'all') return true
    if (filterStatus === 'ready') {
      // Show markets that are ready to settle (closed status OR completed games with scores)
      return m.status === 'closed' || (m.team_a_score > 0 || m.team_b_score > 0)
    }
    return m.status === filterStatus
  })

  // Auto-refresh live scores
  useEffect(() => {
    if (!autoRefresh || !selectedMarket?.espn_id) return

    const interval = setInterval(() => {
      refetchScore()
    }, 30000) // Every 30 seconds

    return () => clearInterval(interval)
  }, [autoRefresh, selectedMarket?.espn_id, refetchScore])

  const refreshAllScores = async () => {
    if (selectedMarket?.espn_id) {
      await refetchScore()
    }
  }

  const handleSettlementSuccess = () => {
    const updatedMarkets = markets.filter(m => m.id !== selectedMarket?.id)
    setLocalMarkets(updatedMarkets)
    
    if (setMarkets) {
      setMarkets(updatedMarkets)
    }
    
    setSelectedMarket(null)
    setSelectedOutcome('')
    router.refresh()
  }

  const handleSelectMarket = (market: Market) => {
    console.log('🎯 Selected Market:', {
      id: market.id,
      teamA: market.team_a?.name,
      teamB: market.team_b?.name,
      score: `${market.team_a_score} - ${market.team_b_score}`,
      status: market.status,
      outcomes: market.market_outcomes.map(o => ({
        id: o.id,
        name: o.outcome_name,
        type: o.outcome_type
      }))
    })
    
    setSelectedMarket(market)
    setSelectedOutcome('')
    setSettlementResult(null)
    
    // Auto-select outcome based on current scores when market is selected
    setTimeout(() => {
      autoSelectOutcome(market)
    }, 100)
  }

  const suggestWinningOutcome = (market: Market): string => {
    console.log('🔍 Determining winning outcome for market:', {
      marketId: market.id,
      teamA: market.team_a?.name,
      teamB: market.team_b?.name,
      score: `${market.team_a_score} - ${market.team_b_score}`,
      status: market.status,
      outcomes: market.market_outcomes.map(o => ({
        id: o.id,
        name: o.outcome_name,
        type: o.outcome_type
      }))
    })

    // Use the scores from the markets table (team_a_score and team_b_score)
    const teamAScore = market.team_a_score
    const teamBScore = market.team_b_score

    console.log('📊 Scores from markets table:', {
      teamAScore,
      teamBScore,
      teamA: market.team_a?.name,
      teamB: market.team_b?.name
    })

    // If scores are 0-0, we can't determine a winner
    if (teamAScore === 0 && teamBScore === 0) {
      console.log('❌ Scores are 0-0, cannot determine winner')
      return ''
    }

    // Find the appropriate outcome based on the score
    if (teamAScore > teamBScore) {
      // Team A wins
      console.log('🏆 Team A wins based on score')
      
      // Try multiple strategies to find the correct outcome
      const possibleOutcomes = [
        // Try exact outcome_type match first
        market.market_outcomes.find(o => o.outcome_type === 'home_win'),
        market.market_outcomes.find(o => o.outcome_type === 'team_a_win'),
        // Try team name in outcome name
        market.market_outcomes.find(o => 
          o.outcome_name.toLowerCase().includes(market.team_a?.name?.toLowerCase() || '')
        ),
        // Try short name in outcome name
        market.market_outcomes.find(o => 
          o.outcome_name.toLowerCase().includes(market.team_a?.short_name?.toLowerCase() || '')
        ),
        // Try "home" or "team a" keywords
        market.market_outcomes.find(o => 
          o.outcome_name.toLowerCase().includes('home') ||
          o.outcome_name.toLowerCase().includes('team a')
        ),
        // Fallback to first outcome that doesn't contain the other team
        market.market_outcomes.find(o => 
          !o.outcome_name.toLowerCase().includes(market.team_b?.name?.toLowerCase() || '') &&
          !o.outcome_name.toLowerCase().includes(market.team_b?.short_name?.toLowerCase() || '')
        )
      ].filter(Boolean) // Remove undefined values

      const winningOutcome = possibleOutcomes[0]
      console.log('✅ Team A winning outcome found:', winningOutcome)
      return winningOutcome?.id || ''

    } else if (teamBScore > teamAScore) {
      // Team B wins
      console.log('🏆 Team B wins based on score')
      
      // Try multiple strategies to find the correct outcome
      const possibleOutcomes = [
        // Try exact outcome_type match first
        market.market_outcomes.find(o => o.outcome_type === 'away_win'),
        market.market_outcomes.find(o => o.outcome_type === 'team_b_win'),
        // Try team name in outcome name
        market.market_outcomes.find(o => 
          o.outcome_name.toLowerCase().includes(market.team_b?.name?.toLowerCase() || '')
        ),
        // Try short name in outcome name
        market.market_outcomes.find(o => 
          o.outcome_name.toLowerCase().includes(market.team_b?.short_name?.toLowerCase() || '')
        ),
        // Try "away" or "team b" keywords
        market.market_outcomes.find(o => 
          o.outcome_name.toLowerCase().includes('away') ||
          o.outcome_name.toLowerCase().includes('team b')
        ),
        // Fallback to first outcome that doesn't contain the other team
        market.market_outcomes.find(o => 
          !o.outcome_name.toLowerCase().includes(market.team_a?.name?.toLowerCase() || '') &&
          !o.outcome_name.toLowerCase().includes(market.team_a?.short_name?.toLowerCase() || '')
        )
      ].filter(Boolean) // Remove undefined values

      const winningOutcome = possibleOutcomes[0]
      console.log('✅ Team B winning outcome found:', winningOutcome)
      return winningOutcome?.id || ''

    } else {
      // Draw
      console.log('🤝 Draw based on score')
      
      const drawOutcome = market.market_outcomes.find(o => 
        o.outcome_type === 'draw' || 
        o.outcome_name.toLowerCase().includes('draw') ||
        o.outcome_name.toLowerCase().includes('tie')
      )
      console.log('✅ Draw outcome found:', drawOutcome)
      return drawOutcome?.id || ''
    }
  }

  const autoSelectOutcome = (market?: Market) => {
    const targetMarket = market || selectedMarket
    if (!targetMarket) {
      console.log('❌ No market selected for auto-select')
      return
    }

    console.log('🔄 Auto-selecting outcome for market:', targetMarket.id)
    
    const suggestedOutcome = suggestWinningOutcome(targetMarket)
    
    if (suggestedOutcome) {
      setSelectedOutcome(suggestedOutcome)
      console.log('✅ Auto-selected outcome:', suggestedOutcome)
      
      // Find and log the selected outcome name for confirmation
      const selectedOutcomeObj = targetMarket.market_outcomes.find(o => o.id === suggestedOutcome)
      if (selectedOutcomeObj) {
        console.log('📋 Selected outcome details:', {
          id: selectedOutcomeObj.id,
          name: selectedOutcomeObj.outcome_name,
          type: selectedOutcomeObj.outcome_type
        })
      }
    } else {
      console.log('❌ No outcome found for auto-selection')
      // If no outcome found, don't auto-select anything
      setSelectedOutcome('')
    }
  }

  const mapESPNStatusToMarketStatus = (espnStatus: string): string => {
    const statusMap: { [key: string]: string } = {
      'in': 'live',
      'halftime': 'live',
      'post': 'closed',
      'final': 'closed',
      'closed': 'closed',
      'suspended': 'suspended',
      'completed': 'closed',
      'full-time': 'closed'
    }
    
    return statusMap[espnStatus] || 'open'
  }

  // Function to close a market (update status to 'closed')
  const closeMarket = async (market: Market) => {
    try {
      const { error } = await supabase
        .from('markets')
        .update({
          status: 'closed',
          updated_at: new Date().toISOString()
        })
        .eq('id', market.id)

      if (!error) {
        // Update local state
        setLocalMarkets(prev => prev.map(m => 
          m.id === market.id ? { ...m, status: 'closed' } : m
        ))
        
        // Update selected market if it's the one being closed
        if (selectedMarket?.id === market.id) {
          setSelectedMarket(prev => prev ? { ...prev, status: 'closed' } : null)
        }
        
        console.log(`✅ Market ${market.id} closed`)
        return true
      } else {
        console.error('Error closing market:', error)
        return false
      }
    } catch (error) {
      console.error('Error closing market:', error)
      return false
    }
  }

  // Function to update scores and close market from live data
  const updateScoresAndCloseMarket = async () => {
    if (!selectedMarket || !liveScore) return

    try {
      const { error } = await supabase
        .from('markets')
        .update({
          team_a_score: liveScore.homeScore,
          team_b_score: liveScore.awayScore,
          status: 'closed',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedMarket.id)

      if (!error) {
        setLocalMarkets(prev => prev.map(m => 
          m.id === selectedMarket.id 
            ? { 
                ...m, 
                team_a_score: liveScore.homeScore, 
                team_b_score: liveScore.awayScore,
                status: 'closed'
              }
            : m
        ))
        setSelectedMarket(prev => prev ? {
          ...prev,
          team_a_score: liveScore.homeScore,
          team_b_score: liveScore.awayScore,
          status: 'closed'
        } : null)
        
        alert('Scores updated from live data and market closed!')
        
        // Auto-select outcome after updating scores
        setTimeout(() => {
          autoSelectOutcome()
        }, 500)
      }
    } catch (error) {
      console.error('Error updating scores:', error)
      alert('Error updating scores')
    }
  }

  const handleSettleMarket = async () => {
    if (!selectedMarket || !selectedOutcome) {
      alert('Please select a winning outcome')
      return
    }

    // Get the selected outcome name for confirmation
    const selectedOutcomeObj = selectedMarket.market_outcomes.find(o => o.id === selectedOutcome)
    const outcomeName = selectedOutcomeObj?.outcome_name || 'Unknown Outcome'

    if (!confirm(
      `Are you sure you want to settle this market?\n\n` +
      `Market: ${selectedMarket.team_a?.name} vs ${selectedMarket.team_b?.name}\n` +
      `Score: ${selectedMarket.team_a_score} - ${selectedMarket.team_b_score}\n` +
      `Winner: ${outcomeName}\n\n` +
      `This action cannot be undone!`
    )) {
      return
    }

    setIsProcessing(true)

    try {
      // Use the RPC function if it exists, otherwise fall back to manual settlement
      const { data, error } = await supabase.rpc('settle_market', {
        p_market_id: selectedMarket.id,
        p_winning_outcome_id: selectedOutcome
      })

      if (error) {
        if (error.message.includes('function') && error.message.includes('does not exist')) {
          await manualSettlement()
        } else {
          throw error
        }
      } else {
        setSettlementResult(data[0])
        
        alert(
          `Market settled successfully! ✅\n\n` +
          `• Positions settled: ${data[0].settled_positions}\n` +
          `• Winners: ${data[0].winners_count}\n` +
          `• Total payout: $${data[0].total_payout.toFixed(2)}`
        )
        
        handleSettlementSuccess()
      }
    } catch (error: any) {
      console.error('Settlement error:', error)
      alert(`Settlement failed: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const manualSettlement = async () => {
    if (!selectedMarket || !selectedOutcome) return

    try {
      const { data: positions, error: positionsError } = await supabase
        .from('positions')
        .select('*')
        .eq('market_id', selectedMarket.id)
        .eq('is_active', true)
        .gt('shares_owned', 0)

      if (positionsError) throw positionsError

      let settledCount = 0
      let winnersCount = 0
      let totalPayout = 0

      // Update market status to settled
      const { error: marketError } = await supabase
        .from('markets')
        .update({
          status: 'settled',
          winning_outcome_id: selectedOutcome,
          settled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedMarket.id)

      if (marketError) {
        console.error('Error updating market:', marketError)
      }

      alert(`Market ${selectedMarket.id} marked as settled. ${positions?.length || 0} positions to process.`)
      
      handleSettlementSuccess()

    } catch (error: any) {
      console.error('Manual settlement error:', error)
      alert(`Settlement failed: ${error.message}`)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      open: 'bg-green-100 text-green-800',
      live: 'bg-blue-100 text-blue-800',
      closed: 'bg-orange-100 text-orange-800',
      settled: 'bg-gray-100 text-gray-800'
    }
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Market Settlement</h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={refreshAllScores}
            disabled={scoreLoading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <FiRefreshCw size={16} className={scoreLoading ? 'animate-spin' : ''} />
            <span>{scoreLoading ? 'Loading...' : 'Refresh Score'}</span>
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              autoRefresh 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {autoRefresh ? <FiPause size={16} /> : <FiPlay size={16} />}
            <span>Auto Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Total Markets</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {markets.length}
              </div>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <FiTrendingUp className="text-gray-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Ready to Settle</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {markets.filter(m => m.status === 'closed' || (m.team_a_score > 0 || m.team_b_score > 0)).length}
              </div>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <FiDollarSign className="text-orange-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Open Markets</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {markets.filter(m => m.status === 'open').length}
              </div>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <FiClock className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Live Markets</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {markets.filter(m => m.status === 'live').length}
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FiPlay className="text-blue-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Markets List */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Markets</h3>
            <div className="flex items-center space-x-2 mt-3">
              {['ready', 'all', 'open', 'live', 'closed'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status as any)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    filterStatus === status
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status === 'ready' ? 'Ready to Settle' : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
            {filteredMarkets.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <FiAlertCircle className="mx-auto text-gray-400 mb-3" size={48} />
                <p className="text-gray-500">No markets found</p>
              </div>
            ) : (
              filteredMarkets.map((market) => (
                <div
                  key={market.id}
                  onClick={() => handleSelectMarket(market)}
                  className={`px-6 py-4 cursor-pointer transition-colors ${
                    selectedMarket?.id === market.id
                      ? 'bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-600">
                        {market.sport?.name}
                      </span>
                      {getStatusBadge(market.status)}
                      {market.espn_id && market.status === 'live' && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                          LIVE
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatDate(market.match_date)}
                    </span>
                  </div>

                  {/* Team vs Team with Scores */}
                  <div className="flex items-center justify-between mb-2">
                    <TeamDisplay 
                      team={market.team_a} 
                      score={market.team_a_score} 
                      isHome={true} 
                    />
                    
                    <div className="mx-4 text-gray-400 font-medium">VS</div>
                    
                    <TeamDisplay 
                      team={market.team_b} 
                      score={market.team_b_score} 
                      isHome={false} 
                    />
                  </div>

                  {/* Action buttons for markets that need to be closed */}
                  {market.status !== 'closed' && (market.team_a_score > 0 || market.team_b_score > 0) && (
                    <div className="mt-2 flex justify-end space-x-2">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (await closeMarket(market)) {
                            alert('Market closed and ready for settlement!')
                          }
                        }}
                        className="px-3 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700 transition-colors"
                      >
                        Close Market
                      </button>
                    </div>
                  )}

                  {/* Show warning if scores are 0-0 */}
                  {market.team_a_score === 0 && market.team_b_score === 0 && market.status !== 'closed' && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-center">
                      <span className="text-xs text-yellow-700">
                        ⚠️ Scores not available - check live data
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Settlement Panel */}
        <div className="bg-white rounded-lg border border-gray-200">
          {!selectedMarket ? (
            <div className="px-6 py-12 text-center">
              <FiAlertCircle className="mx-auto text-gray-400 mb-3" size={48} />
              <p className="text-gray-500">Select a market to settle</p>
            </div>
          ) : (
            <div className="p-6">
              <div className="mb-6">
                {/* Selected Market Header with Logos and Scores */}
                <div className="flex items-center justify-between mb-4">
                  <TeamDisplay 
                    team={selectedMarket.team_a} 
                    score={selectedMarket.team_a_score} 
                    isHome={true} 
                  />
                  
                  <div className="mx-4 text-gray-400 font-medium text-lg">VS</div>
                  
                  <TeamDisplay 
                    team={selectedMarket.team_b} 
                    score={selectedMarket.team_b_score} 
                    isHome={false} 
                  />
                </div>

                <div className="flex items-center space-x-4 text-sm text-gray-600 mt-2 justify-center">
                  <span>{selectedMarket.sport?.name}</span>
                  <span>{formatDate(selectedMarket.match_date)}</span>
                  {getStatusBadge(selectedMarket.status)}
                </div>

                {/* Score Display */}
                <div className={`mt-4 p-3 border rounded-lg text-center ${
                  selectedMarket.team_a_score === 0 && selectedMarket.team_b_score === 0 
                    ? 'bg-yellow-50 border-yellow-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="font-mono text-lg font-bold text-gray-900">
                    Final Score: {selectedMarket.team_a_score} - {selectedMarket.team_b_score}
                  </div>
                  <div className={`text-sm mt-1 ${
                    selectedMarket.team_a_score === 0 && selectedMarket.team_b_score === 0 
                      ? 'text-yellow-700' 
                      : 'text-gray-600'
                  }`}>
                    {selectedMarket.team_a_score === 0 && selectedMarket.team_b_score === 0 
                      ? '⚠️ Scores not available in database' 
                      : 'Using scores from markets table'}
                  </div>
                </div>

                {/* Live Score Display */}
                {liveScore && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center justify-center space-x-4">
                      <span className="font-mono text-red-600 font-bold text-lg">
                        LIVE: {liveScore.homeScore} - {liveScore.awayScore}
                      </span>
                      {liveScore.clock && (
                        <span className="text-sm text-red-600 bg-red-100 px-2 py-1 rounded">
                          {liveScore.clock}
                        </span>
                      )}
                      {liveScore.period > 0 && (
                        <span className="text-sm text-red-600">
                          Period {liveScore.period}
                        </span>
                      )}
                    </div>
                    <div className="text-center text-xs text-red-600 mt-1">
                      Status: {liveScore.status} | {liveScore.detail}
                    </div>
                    
                    {/* Button to update scores from live data */}
                    <button
                      onClick={updateScoresAndCloseMarket}
                      className="mt-2 w-full px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                    >
                      Update Scores & Close Market
                    </button>
                  </div>
                )}

                {scoreLoading && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <FiRefreshCw className="animate-spin" />
                      <span className="text-blue-600">Loading live score...</span>
                    </div>
                  </div>
                )}
              </div>

              {selectedMarket.status !== 'closed' && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center text-yellow-800">
                    <FiAlertCircle className="mr-2" />
                    <span className="text-sm font-medium">
                      Market is still {selectedMarket.status}. You need to close the market before settling.
                    </span>
                  </div>
                  <div className="mt-2 flex space-x-2">
                    <button
                      onClick={async () => {
                        if (await closeMarket(selectedMarket)) {
                          alert('Market closed and ready for settlement!')
                        }
                      }}
                      className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 transition-colors"
                    >
                      Close Market
                    </button>
                    {liveScore && (
                      <button
                        onClick={updateScoresAndCloseMarket}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                      >
                        Update Scores & Close
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Select Winning Outcome
                  </label>
                  <button
                    onClick={() => autoSelectOutcome()}
                    className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200 transition-colors"
                  >
                    Auto-Select Based on Score
                  </button>
                </div>
                <div className="space-y-3">
                  {selectedMarket.market_outcomes.map((outcome) => (
                    <label
                      key={outcome.id}
                      className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedOutcome === outcome.id
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center flex-1">
                        <input
                          type="radio"
                          name="winning_outcome"
                          value={outcome.id}
                          checked={selectedOutcome === outcome.id}
                          onChange={(e) => setSelectedOutcome(e.target.value)}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{outcome.outcome_name}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            {outcome.total_shares.toFixed(2)} shares • ${outcome.current_price.toFixed(4)} • Reserve: ${outcome.reserve.toFixed(2)}
                          </div>
                        </div>
                      </div>
                      {selectedOutcome === outcome.id && (
                        <FiCheck className="text-green-600 ml-2" size={20} />
                      )}
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSettleMarket}
                disabled={isProcessing || !selectedOutcome || selectedMarket.status !== 'closed'}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Settling Market...
                  </div>
                ) : selectedMarket.status !== 'closed' ? (
                  'Close Market First'
                ) : (
                  <div className="flex items-center justify-center">
                    <FiCheck className="mr-2" />
                    Settle Market
                  </div>
                )}
              </button>

              {settlementResult && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center text-green-800 font-medium mb-2">
                    <FiCheck className="mr-2" />
                    Settlement Complete
                  </div>
                  <div className="text-sm text-green-700 space-y-1">
                    <div>Positions settled: {settlementResult.settled_positions}</div>
                    <div>Winners: {settlementResult.winners_count}</div>
                    <div>Total payout: ${settlementResult.total_payout.toFixed(2)}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
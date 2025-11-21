'use client'

import { useState, useEffect } from 'react'
import { FiStar, FiTrendingUp, FiActivity, FiHome } from 'react-icons/fi'
import TradingModal from './TradingModal'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

interface Market {
  id: string
  sport: { name: string; code: string }
  league: { name: string; country_code: string }
  team_a: { 
    id?: string
    name: string; 
    short_name: string; 
    logo_url: string | null
  }
  team_b: { 
    id?: string
    name: string; 
    short_name: string; 
    logo_url: string | null
  }
  home_team: { name: string; id?: string }
  match_date: string
  market_type: 'binary' | 'multi_choice'
  is_featured: boolean
  status: 'open' | 'live' | 'suspended' | 'closed' | 'settled' | 'resolved'
  team_a_score: number
  team_b_score: number
  market_outcomes: Array<{
    id: string
    outcome_name: string
    current_price: number
    price_change_24h: number
  }>
}

interface MarketCardProps {
  market: Market
  viewMode: 'grid' | 'list'
}

// Team logo component with fallback
const TeamLogo = ({ team, size = 12 }: { team: { logo_url: string | null; short_name: string }; size?: number }) => {
  if (team.logo_url) {
    return (
      <Image
        src={team.logo_url}
        alt={team.short_name}
        width={size}
        height={size}
        className="rounded-full object-cover"
      />
    )
  }
  
  return (
    <div className="bg-gray-300 rounded-full flex items-center justify-center text-xs font-bold text-gray-700 shadow-sm"
         style={{ width: `${size}px`, height: `${size}px` }}>
      {team.short_name?.substring(0, 2) || 'T'}
    </div>
  )
}

// Format time until match
const formatTimeUntilMatch = (matchDate: string) => {
  const date = new Date(matchDate)
  const now = new Date()
  const timeUntilMatch = date.getTime() - now.getTime()
  const hoursUntilMatch = Math.floor(timeUntilMatch / (1000 * 60 * 60))
  
  if (hoursUntilMatch > 24) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } else if (hoursUntilMatch > 0) {
    return `${hoursUntilMatch}h`
  } else {
    return 'Soon'
  }
}

// Enhanced Score display component with period/quarter info
const ScoreDisplay = ({ 
  teamAScore, 
  teamBScore, 
  isLive = false,
  size = 'md',
  period = null,
  timeRemaining = null,
  scoreAnimation = { team: null as 'a' | 'b' | null }
}: { 
  teamAScore: number; 
  teamBScore: number;
  isLive?: boolean;
  size?: 'sm' | 'md' | 'lg';
  period?: string | null;
  timeRemaining?: string | null;
  scoreAnimation?: { team: 'a' | 'b' | null };
}) => {
  const sizeClasses = {
    sm: 'px-2 py-1 text-sm space-x-1',
    md: 'px-3 py-1.5 text-lg space-x-2',
    lg: 'px-4 py-2 text-xl space-x-3'
  }

  const liveIndicator = (
    <div className="flex items-center space-x-1">
      <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"></div>
      <span className="text-xs font-medium text-red-200">LIVE</span>
    </div>
  )

  return (
    <div className="flex flex-col items-center space-y-1">
      {/* Main Score Display */}
      <div className={`
        flex items-center rounded-lg font-mono font-bold
        ${isLive 
          ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-500/25' 
          : 'bg-gray-900 text-white'
        }
        ${sizeClasses[size]}
      `}>
        <span className={`min-w-[20px] text-center transition-all duration-300 ${
          scoreAnimation.team === 'a' ? 'animate-pulse scale-110' : ''
        }`}>{teamAScore}</span>
        <span className={isLive ? "text-red-200" : "text-gray-400"}>-</span>
        <span className={`min-w-[20px] text-center transition-all duration-300 ${
          scoreAnimation.team === 'b' ? 'animate-pulse scale-110' : ''
        }`}>{teamBScore}</span>
        {isLive && (
          <>
            <div className="w-px h-4 bg-white/20 mx-1"></div>
            {liveIndicator}
          </>
        )}
      </div>

      {/* Game Info (Period/Time) */}
      {(period || timeRemaining) && isLive && (
        <div className="flex items-center space-x-2 text-xs text-gray-600">
          {period && <span>{period}</span>}
          {timeRemaining && (
            <>
              {period && <span>•</span>}
              <span>{timeRemaining}</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// Compact score display for tight spaces
const CompactScoreDisplay = ({ 
  teamAScore, 
  teamBScore, 
  isLive = false 
}: { 
  teamAScore: number; 
  teamBScore: number;
  isLive?: boolean;
}) => {
  return (
    <div className={`
      flex items-center px-2 py-1 rounded-md font-mono text-sm font-bold
      ${isLive 
        ? 'bg-red-500 text-white' 
        : 'bg-gray-800 text-white'
      }
    `}>
      <span>{teamAScore}</span>
      <span className="mx-1 text-gray-400">-</span>
      <span>{teamBScore}</span>
      {isLive && (
        <div className="ml-1.5 w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
      )}
    </div>
  )
}

// Enhanced team display with scoring momentum
const TeamWithScore = ({ 
  team, 
  score, 
  isLeading = false,
  isAnimated = false,
  isHomeTeam = false
}: { 
  team: { name: string; short_name: string; logo_url: string | null };
  score: number;
  isLeading?: boolean;
  isAnimated?: boolean;
  isHomeTeam?: boolean;
}) => {
  return (
    <div className="text-center flex-1">
      <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 bg-gray-100 border relative">
        <TeamLogo team={team} size={40} />
        {isHomeTeam && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
            <FiHome className="text-white" size={8} />
          </div>
        )}
      </div>
      <div className={`text-sm font-medium text-center leading-tight line-clamp-2 ${
        isLeading ? 'text-green-600 font-bold' : 'text-gray-900'
      }`}>
        {team.short_name}
      </div>
      <div className={`text-2xl font-bold mt-2 transition-all duration-300 ${
        isAnimated ? 'animate-pulse text-green-600 scale-110' : 
        isLeading ? 'text-green-600' : 'text-gray-900'
      }`}>
        {score}
      </div>
    </div>
  )
}

// Enhanced market status with score context
const getMarketStatus = (market: Market) => {
  const matchDate = new Date(market.match_date)
  const now = new Date()
  const hoursUntilMatch = (matchDate.getTime() - now.getTime()) / (1000 * 60 * 60)
  const isMatchStarted = now >= matchDate
  const hasActiveScoring = market.team_a_score > 0 || market.team_b_score > 0
  
  if (market.status === 'live') {
    return {
      label: hasActiveScoring ? 'LIVE SCORING' : 'LIVE',
      color: hasActiveScoring ? 'bg-red-600 text-white' : 'bg-red-500 text-white',
      animate: 'animate-pulse',
      showScore: true,
      isLive: true,
      hasScoring: hasActiveScoring
    }
  } else if (market.status === 'suspended' && isMatchStarted) {
    return {
      label: 'SUSPENDED',
      color: 'bg-yellow-500 text-white',
      animate: '',
      showScore: true,
      isLive: false,
      hasScoring: hasActiveScoring
    }
  } else if (market.status === 'closed' || market.status === 'settled' || market.status === 'resolved') {
    const isCloseGame = Math.abs(market.team_a_score - market.team_b_score) <= 3
    return {
      label: market.status === 'resolved' ? 
        (isCloseGame ? 'FINAL (CLOSE)' : 'FINAL') : 
        'CLOSED',
      color: isCloseGame ? 'bg-purple-500 text-white' : 'bg-gray-500 text-white',
      animate: '',
      showScore: true,
      isLive: false,
      hasScoring: hasActiveScoring
    }
  } else if (hoursUntilMatch <= 1 && hoursUntilMatch > 0) {
    return {
      label: 'STARTING SOON',
      color: 'bg-orange-500 text-white',
      animate: 'animate-pulse',
      showScore: false,
      isLive: false,
      hasScoring: false
    }
  } else if (market.status === 'open' && hoursUntilMatch > 0) {
    return {
      label: 'ACTIVE',
      color: 'bg-green-500 text-white',
      animate: '',
      showScore: false,
      isLive: false,
      hasScoring: false
    }
  }
  
  return {
    label: 'SCHEDULED',
    color: 'bg-blue-500 text-white',
    animate: '',
    showScore: false,
    isLive: false,
    hasScoring: false
  }
}

// Price change indicator
const PriceChange = ({ change }: { change: number }) => {
  const isPositive = change > 0
  const isNegative = change < 0
  
  return (
    <div className={`text-xs px-1.5 py-0.5 rounded ${
      isPositive ? 'bg-green-100 text-green-700' :
      isNegative ? 'bg-red-100 text-red-700' :
      'bg-gray-100 text-gray-600'
    }`}>
      {isPositive ? '↗' : isNegative ? '↘' : '→'} {Math.abs(change).toFixed(1)}%
    </div>
  )
}

// Score-based badges for game context
const GameContextBadges = ({ market, statusInfo }: { market: Market; statusInfo: any }) => {
  if (!statusInfo.hasScoring || !statusInfo.isLive) return null

  const scoreDiff = Math.abs(market.team_a_score - market.team_b_score)
  const totalScore = market.team_a_score + market.team_b_score

  return (
    <div className="flex items-center justify-center space-x-1 mt-2 flex-wrap">
      {scoreDiff <= 3 && (
        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
          Close Game
        </span>
      )}
      {totalScore > 40 && (
        <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
          High Scoring
        </span>
      )}
      {market.team_a_score === market.team_b_score && (
        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
          Tied Game
        </span>
      )}
      {scoreDiff >= 15 && (
        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full font-medium">
          Blowout
        </span>
      )}
    </div>
  )
}

export default function MarketCard({ market: initialMarket, viewMode }: MarketCardProps) {
  const [market, setMarket] = useState(initialMarket)
  const [isTradingModalOpen, setIsTradingModalOpen] = useState(false)
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null)
  const [scoreAnimation, setScoreAnimation] = useState<{ team: 'a' | 'b' | null }>({ team: null })
  const supabase = createClient()

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel(`market-${market.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'markets',
          filter: `id=eq.${market.id}`
        },
        (payload) => {
          console.log('Market updated:', payload)
          const updatedMarket = payload.new as any
          
          // Animate score changes
          if (updatedMarket.team_a_score !== market.team_a_score) {
            setScoreAnimation({ team: 'a' })
            setTimeout(() => setScoreAnimation({ team: null }), 1000)
          }
          if (updatedMarket.team_b_score !== market.team_b_score) {
            setScoreAnimation({ team: 'b' })
            setTimeout(() => setScoreAnimation({ team: null }), 1000)
          }
          
          setMarket((prev) => ({
            ...prev,
            ...updatedMarket,
            team_a_score: updatedMarket.team_a_score || 0,
            team_b_score: updatedMarket.team_b_score || 0,
            status: updatedMarket.status
          }))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'market_outcomes',
          filter: `market_id=eq.${market.id}`
        },
        async (payload) => {
          console.log('Outcome updated:', payload)
          // Refetch outcomes
          const { data: outcomes } = await supabase
            .from('market_outcomes')
            .select('id, outcome_name, current_price, price_change_24h')
            .eq('market_id', market.id)
          
          if (outcomes) {
            setMarket((prev) => ({
              ...prev,
              market_outcomes: outcomes
            }))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [market.id, supabase, market.team_a_score, market.team_b_score])

  const handleOutcomeClick = (outcomeId: string) => {
    setSelectedOutcome(outcomeId)
    setIsTradingModalOpen(true)
  }

  const statusInfo = getMarketStatus(market)
  const isTeamAHome = market.home_team?.id === market.team_a?.id
  const isTeamBHome = market.home_team?.id === market.team_b?.id
  const isTeamALeading = market.team_a_score > market.team_b_score
  const isTeamBLeading = market.team_b_score > market.team_a_score

  // Mobile-first design - simplified for small screens
  if (viewMode === 'list') {
    return (
      <>
        <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">
          {/* Status Badge and Featured */}
          <div className="flex items-center justify-between mb-3">
            <div className={`px-2 py-1 rounded-md text-xs font-bold ${statusInfo.color} ${statusInfo.animate} flex items-center space-x-1`}>
              {statusInfo.label === 'LIVE' && <FiActivity size={12} />}
              <span>{statusInfo.label}</span>
            </div>
            {market.is_featured && (
              <FiStar className="text-yellow-500" size={16} />
            )}
          </div>

          {/* Game Context Badges */}
          <GameContextBadges market={market} statusInfo={statusInfo} />

          {/* Header - Teams and basic info */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {/* Team A */}
              <div className="flex items-center space-x-2 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 border relative">
                  <TeamLogo team={market.team_a} size={28} />
                  {isTeamAHome && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                      <FiHome className="text-white" size={6} />
                    </div>
                  )}
                </div>
                <span className={`text-sm font-medium truncate ${
                  isTeamALeading ? 'text-green-600 font-bold' : 'text-gray-900'
                }`}>
                  {market.team_a.short_name}
                </span>
              </div>

              {/* VS/Score and time */}
              <div className="flex flex-col items-center px-2 shrink-0">
                {statusInfo.showScore ? (
                  <ScoreDisplay 
                    teamAScore={market.team_a_score} 
                    teamBScore={market.team_b_score}
                    isLive={statusInfo.isLive}
                    size="md"
                    scoreAnimation={scoreAnimation}
                  />
                ) : (
                  <>
                    <div className="text-xs text-gray-500 font-medium">VS</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {formatTimeUntilMatch(market.match_date)}
                    </div>
                  </>
                )}
              </div>

              {/* Team B */}
              <div className="flex items-center space-x-2 min-w-0 flex-1 justify-end">
                <span className={`text-sm font-medium truncate text-right ${
                  isTeamBLeading ? 'text-green-600 font-bold' : 'text-gray-900'
                }`}>
                  {market.team_b.short_name}
                </span>
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 border relative">
                  <TeamLogo team={market.team_b} size={28} />
                  {isTeamBHome && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                      <FiHome className="text-white" size={6} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Outcomes - Horizontal scroll for mobile */}
          <div className="flex space-x-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
            {market.market_outcomes?.map((outcome) => (
              <button
                key={outcome.id}
                onClick={() => handleOutcomeClick(outcome.id)}
                className="flex-1 min-w-[120px] p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group shrink-0"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-medium text-gray-700 group-hover:text-blue-700 truncate">
                    {outcome.outcome_name}
                  </span>
                  <PriceChange change={outcome.price_change_24h} />
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900 group-hover:text-blue-900">
                    ${outcome.current_price.toFixed(2)}
                  </span>
                  <FiTrendingUp 
                    className="text-gray-300 group-hover:text-blue-400 transition-colors" 
                    size={16} 
                  />
                </div>
              </button>
            ))}
          </div>

          {/* League info */}
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              {market.league.name}
            </span>
            <span className="text-xs text-gray-400">
              {market.market_type === 'binary' ? '2-Way' : '3-Way'}
            </span>
          </div>
        </div>

        <TradingModal
          isOpen={isTradingModalOpen}
          onClose={() => setIsTradingModalOpen(false)}
          market={market}
          outcomeId={selectedOutcome}
        />
      </>
    )
  }

  // Grid View - Mobile optimized
  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-all duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-700 rounded">
              {market.sport.name}
            </span>
            {market.is_featured && (
              <FiStar className="text-yellow-500" size={14} />
            )}
          </div>
          <div className={`text-xs px-2 py-1 rounded font-bold ${statusInfo.color} ${statusInfo.animate} flex items-center space-x-1`}>
            {statusInfo.label === 'LIVE' && <FiActivity size={12} />}
            <span>{statusInfo.label}</span>
          </div>
        </div>

        {/* Game Context Badges */}
        <GameContextBadges market={market} statusInfo={statusInfo} />

        {/* Teams with Enhanced Score Display */}
        <div className="flex items-center justify-between mb-4">
          <TeamWithScore 
            team={market.team_a} 
            score={market.team_a_score}
            isLeading={isTeamALeading}
            isAnimated={scoreAnimation.team === 'a'}
            isHomeTeam={isTeamAHome}
          />

          <div className="flex flex-col items-center px-2">
            {statusInfo.showScore ? (
              <ScoreDisplay 
                teamAScore={market.team_a_score} 
                teamBScore={market.team_b_score}
                isLive={statusInfo.isLive}
                size="md"
                scoreAnimation={scoreAnimation}
              />
            ) : (
              <>
                <div className="text-gray-400 font-semibold text-sm">VS</div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatTimeUntilMatch(market.match_date)}
                </div>
              </>
            )}
          </div>

          <TeamWithScore 
            team={market.team_b} 
            score={market.team_b_score}
            isLeading={isTeamBLeading}
            isAnimated={scoreAnimation.team === 'b'}
            isHomeTeam={isTeamBHome}
          />
        </div>

        {/* Outcomes */}
        <div className="space-y-2">
          {market.market_outcomes?.map((outcome) => (
            <button
              key={outcome.id}
              onClick={() => handleOutcomeClick(outcome.id)}
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700 truncate">
                  {outcome.outcome_name}
                </span>
                <PriceChange change={outcome.price_change_24h} />
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900 group-hover:text-blue-900">
                  ${outcome.current_price.toFixed(2)}
                </span>
                <FiTrendingUp 
                  className="text-gray-300 group-hover:text-blue-400 transition-colors" 
                  size={16} 
                />
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-500 truncate">
            {market.league.name}
          </span>
          <span className="text-xs text-gray-400">
            {market.market_type === 'binary' ? '2-Way' : '3-Way'}
          </span>
        </div>
      </div>

      <TradingModal
        isOpen={isTradingModalOpen}
        onClose={() => setIsTradingModalOpen(false)}
        market={market}
        outcomeId={selectedOutcome}
      />
    </>
  )
}
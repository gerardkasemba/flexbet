'use client'

import { useState, useMemo } from 'react'
import MarketCard from './MarketCard'
import { FiGrid, FiList, FiFilter, FiX, FiSearch, FiChevronDown } from 'react-icons/fi'

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
  home_team: { name: string }
  match_date: string
  venue_type: 'home_away' | 'neutral'
  market_type: 'binary' | 'multi_choice'
  is_featured: boolean
  status: 'open' | 'live' | 'suspended' | 'closed' | 'settled' | 'resolved'
  team_a_score: number
  team_b_score: number
  total_liquidity: number
  market_outcomes: Array<{
    id: string
    outcome_type: string
    outcome_name: string
    current_price: number
    total_shares: number
    volume_24h: number
    price_change_24h: number
  }>
}

interface MarketsGridProps {
  markets: Market[]
  searchParams: { [key: string]: string | string[] | undefined }
}

type SortOption = 'date' | 'liquidity' | 'volume' | 'featured' | 'score_impact'
type StatusFilter = 'all' | 'live' | 'upcoming' | 'settled' | 'scoring'

export default function MarketsGrid({ markets, searchParams }: MarketsGridProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<SortOption>('date')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sportFilter, setSportFilter] = useState<string>('all')
  const [leagueFilter, setLeagueFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  // Extract unique sports and leagues for filter options
  const { sports, leagues } = useMemo(() => {
    const sportsSet = new Set<string>()
    const leaguesSet = new Set<string>()
    
    markets.forEach(market => {
      if (market.sport?.name) sportsSet.add(market.sport.name)
      if (market.league?.name) leaguesSet.add(market.league.name)
    })

    return {
      sports: Array.from(sportsSet).sort(),
      leagues: Array.from(leaguesSet).sort()
    }
  }, [markets])

  // Filter markets based on all criteria
  const filteredMarkets = useMemo(() => {
    return markets.filter(market => {
      // Search query filter (teams names and scores)
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const teamAMatch = market.team_a?.name?.toLowerCase().includes(query) || 
                          market.team_a?.short_name?.toLowerCase().includes(query) ||
                          market.team_a_score?.toString().includes(query)
        const teamBMatch = market.team_b?.name?.toLowerCase().includes(query) || 
                          market.team_b?.short_name?.toLowerCase().includes(query) ||
                          market.team_b_score?.toString().includes(query)
        const leagueMatch = market.league?.name?.toLowerCase().includes(query)
        
        if (!teamAMatch && !teamBMatch && !leagueMatch) {
          return false
        }
      }

      // Sport filter
      if (sportFilter !== 'all' && market.sport?.name !== sportFilter) {
        return false
      }

      // League filter
      if (leagueFilter !== 'all' && market.league?.name !== leagueFilter) {
        return false
      }

      // Status filters with score consideration
      const now = new Date()
      const matchDate = new Date(market.match_date)
      const isLive = market.status === 'live'
      const isUpcoming = market.status === 'open' && matchDate > now
      const isSettled = ['settled', 'resolved', 'closed'].includes(market.status)
      const hasActiveScoring = isLive && (market.team_a_score > 0 || market.team_b_score > 0)

      switch (statusFilter) {
        case 'live':
          return isLive
        case 'upcoming':
          return isUpcoming
        case 'settled':
          return isSettled
        case 'scoring':
          return hasActiveScoring
        default:
          return true
      }
    })
  }, [markets, searchQuery, sportFilter, leagueFilter, statusFilter])

  // Sort markets with score-based options
  const sortedMarkets = useMemo(() => {
    return [...filteredMarkets].sort((a, b) => {
      const now = new Date()
      const aDate = new Date(a.match_date)
      const bDate = new Date(b.match_date)
      
      // Live matches with scores first, then other live matches
      const aIsLive = a.status === 'live'
      const bIsLive = b.status === 'live'
      const aHasScoring = aIsLive && (a.team_a_score > 0 || a.team_b_score > 0)
      const bHasScoring = bIsLive && (b.team_a_score > 0 || b.team_b_score > 0)
      
      // Priority: Live with scores > Live without scores > Others
      if (aHasScoring && !bHasScoring) return -1
      if (!aHasScoring && bHasScoring) return 1
      if (aIsLive && !bIsLive) return -1
      if (!aIsLive && bIsLive) return 1

      switch (sortBy) {
        case 'date':
          return aDate.getTime() - bDate.getTime()
        case 'liquidity':
          return (b.total_liquidity || 0) - (a.total_liquidity || 0)
        case 'volume':
          const volumeA = a.market_outcomes?.reduce((sum, outcome) => sum + (outcome.volume_24h || 0), 0) || 0
          const volumeB = b.market_outcomes?.reduce((sum, outcome) => sum + (outcome.volume_24h || 0), 0) || 0
          return volumeB - volumeA
        case 'featured':
          if (a.is_featured && !b.is_featured) return -1
          if (!a.is_featured && b.is_featured) return 1
          return aDate.getTime() - bDate.getTime()
        case 'score_impact':
          // Sort by total score (high-scoring games first) or game excitement
          const aTotalScore = (a.team_a_score || 0) + (a.team_b_score || 0)
          const bTotalScore = (b.team_a_score || 0) + (b.team_b_score || 0)
          const aScoreDiff = Math.abs((a.team_a_score || 0) - (a.team_b_score || 0))
          const bScoreDiff = Math.abs((b.team_a_score || 0) - (b.team_b_score || 0))
          
          // Close games with high scores get priority
          if (aTotalScore > 0 || bTotalScore > 0) {
            if (aTotalScore !== bTotalScore) {
              return bTotalScore - aTotalScore
            }
            // If same total score, closer games are more exciting
            return aScoreDiff - bScoreDiff
          }
          return aDate.getTime() - bDate.getTime()
        default:
          return 0
      }
    })
  }, [filteredMarkets, sortBy])

  // Get active filter count for badge
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (statusFilter !== 'all') count++
    if (sportFilter !== 'all') count++
    if (leagueFilter !== 'all') count++
    if (searchQuery) count++
    return count
  }, [statusFilter, sportFilter, leagueFilter, searchQuery])

  const clearFilters = () => {
    setStatusFilter('all')
    setSportFilter('all')
    setLeagueFilter('all')
    setSearchQuery('')
    setSortBy('date')
  }

  const hasActiveFilters = activeFilterCount > 0

  return (
    <div className="space-y-6">
      {/* Mobile Filter Bar */}
      <div className="lg:hidden bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between space-x-3">
          {/* Search Bar - Mobile */}
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search markets or scores..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <FiFilter size={16} />
            {activeFilterCount > 0 && (
              <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* View Toggle - Mobile */}
          <div className="flex border border-gray-300 rounded-lg p-1 flex-shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${
                viewMode === 'grid' 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FiGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${
                viewMode === 'list' 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FiList size={16} />
            </button>
          </div>
        </div>

        {/* Mobile Expanded Filters */}
        {showFilters && (
          <div className="mt-4 space-y-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="live">Live Now</option>
                <option value="scoring">Live with Scores</option>
                <option value="upcoming">Upcoming</option>
                <option value="settled">Settled</option>
              </select>
            </div>

            {/* Sport Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sport</label>
              <select
                value={sportFilter}
                onChange={(e) => setSportFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Sports</option>
                {sports.map(sport => (
                  <option key={sport} value={sport}>{sport}</option>
                ))}
              </select>
            </div>

            {/* League Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">League</label>
              <select
                value={leagueFilter}
                onChange={(e) => setLeagueFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Leagues</option>
                {leagues.map(league => (
                  <option key={league} value={league}>{league}</option>
                ))}
              </select>
            </div>

            {/* Sort By - Mobile */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="date">Match Date</option>
                <option value="liquidity">Liquidity</option>
                <option value="volume">Trading Volume</option>
                <option value="featured">Featured First</option>
                <option value="score_impact">Score Impact</option>
              </select>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="w-full px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear All Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Desktop Filter Bar */}
      <div className="hidden lg:block bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center space-x-4">
          {/* Search Bar - Desktop */}
          <div className="flex-1 max-w-md relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search teams, leagues, or scores..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px]"
          >
            <option value="all">All Status</option>
            <option value="live">Live Now</option>
            <option value="scoring">Live with Scores</option>
            <option value="upcoming">Upcoming</option>
            <option value="settled">Settled</option>
          </select>

          {/* Sport Filter */}
          <select
            value={sportFilter}
            onChange={(e) => setSportFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px]"
          >
            <option value="all">All Sports</option>
            {sports.map(sport => (
              <option key={sport} value={sport}>{sport}</option>
            ))}
          </select>

          {/* League Filter */}
          <select
            value={leagueFilter}
            onChange={(e) => setLeagueFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[160px]"
          >
            <option value="all">All Leagues</option>
            {leagues.map(league => (
              <option key={league} value={league}>{league}</option>
            ))}
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px]"
          >
            <option value="date">Match Date</option>
            <option value="liquidity">Liquidity</option>
            <option value="volume">Trading Volume</option>
            <option value="featured">Featured First</option>
            <option value="score_impact">Score Impact</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex border border-gray-300 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${
                viewMode === 'grid' 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Grid view"
            >
              <FiGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${
                viewMode === 'list' 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="List view"
            >
              <FiList size={16} />
            </button>
          </div>

          {/* Clear Filters - Desktop */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-700 transition-colors border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <FiX size={14} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-600 px-2">
        Showing <span className="font-semibold">{sortedMarkets.length}</span> of{' '}
        <span className="font-semibold">{markets.length}</span> markets
        {hasActiveFilters && (
          <span className="text-blue-600 ml-2">
            ({activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active)
          </span>
        )}
      </div>

      {/* Markets Grid/List */}
      {sortedMarkets.length > 0 ? (
        <div className={
          viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'
            : 'space-y-4'
        }>
          {sortedMarkets.map((market) => (
            <MarketCard 
              key={market.id} 
              market={market} 
              viewMode={viewMode}
            />
          ))}
        </div>
      ) : (
        /* No Results */
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="text-gray-400 text-lg mb-2">No markets found</div>
          <p className="text-gray-500 mb-4">Try adjusting your filters or search criteria</p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
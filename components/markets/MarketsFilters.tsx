'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FiFilter, FiSearch, FiX } from 'react-icons/fi'

interface Sport {
  id: string
  name: string
  code: string
}

interface League {
  id: string
  name: string
  sport_id: string
}

interface MarketsFiltersProps {
  searchParams?: { [key: string]: string | string[] | undefined }
}

export default function MarketsFilters({ searchParams }: MarketsFiltersProps) {
  const router = useRouter()
  const params = useSearchParams()
  
  const [sports, setSports] = useState<Sport[]>([])
  const [leagues, setLeagues] = useState<League[]>([])
  const [filteredLeagues, setFilteredLeagues] = useState<League[]>([])
  
  // Initialize state from URL search params
  const [filters, setFilters] = useState({
    sport: params?.get('sport') || '',
    league: params?.get('league') || '',
    featured: params?.get('featured') === 'true',
    searchQuery: params?.get('search') || ''
  })
  
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    loadSportsAndLeagues()
  }, [])

  useEffect(() => {
    if (filters.sport) {
      setFilteredLeagues(leagues.filter(league => league.sport_id === filters.sport))
    } else {
      setFilteredLeagues([])
    }
  }, [filters.sport, leagues])

  // Update URL when filters change
  useEffect(() => {
    const newParams = new URLSearchParams()
    
    if (filters.sport) newParams.set('sport', filters.sport)
    if (filters.league) newParams.set('league', filters.league)
    if (filters.featured) newParams.set('featured', 'true')
    if (filters.searchQuery) newParams.set('search', filters.searchQuery)
    
    const queryString = newParams.toString()
    const newUrl = queryString ? `/dashboard/markets?${queryString}` : '/dashboard/markets'
    
    router.push(newUrl, { scroll: false })
  }, [filters, router])

  const loadSportsAndLeagues = async () => {
    try {
      const [sportsRes, leaguesRes] = await Promise.all([
        supabase.from('sports').select('*').order('name'),
        supabase.from('leagues').select('*').order('name')
      ])

      if (sportsRes.data) setSports(sportsRes.data)
      if (leaguesRes.data) setLeagues(leaguesRes.data)
    } catch (error) {
      console.error('Error loading sports and leagues:', error)
    }
  }

  const clearFilters = () => {
    setFilters({
      sport: '',
      league: '',
      featured: false,
      searchQuery: ''
    })
    setIsFiltersOpen(false)
  }

  const hasActiveFilters = filters.sport || filters.league || filters.featured || filters.searchQuery

  // Get active filter count for badge
  const activeFilterCount = [
    filters.sport,
    filters.league,
    filters.featured,
    filters.searchQuery
  ].filter(Boolean).length

  return (
    <div className="flex flex-col space-y-4">
      {/* Main Filter Bar */}
      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[250px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search markets, teams, or leagues..."
            value={filters.searchQuery}
            onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full text-sm"
          />
          {filters.searchQuery && (
            <button
              onClick={() => setFilters({ ...filters, searchQuery: '' })}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <FiX className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {/* Filter Toggle */}
        <div className="flex space-x-2">
          <button
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <FiFilter size={16} />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="bg-blue-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-600"
            >
              <FiX size={16} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Expanded Filters */}
      {isFiltersOpen && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Sport Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sport
              </label>
              <select
                value={filters.sport}
                onChange={(e) => setFilters({ ...filters, sport: e.target.value, league: '' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="">All Sports</option>
                {sports.map(sport => (
                  <option key={sport.id} value={sport.id}>
                    {sport.name}
                  </option>
                ))}
              </select>
            </div>

            {/* League Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                League
              </label>
              <select
                value={filters.league}
                onChange={(e) => setFilters({ ...filters, league: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                disabled={!filters.sport}
              >
                <option value="">All Leagues</option>
                {filteredLeagues.map(league => (
                  <option key={league.id} value={league.id}>
                    {league.name}
                  </option>
                ))}
              </select>
              {!filters.sport && (
                <p className="text-xs text-gray-500 mt-1">Select a sport first</p>
              )}
            </div>

            {/* Match Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Match Time
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                onChange={(e) => {
                  // You can add time-based filtering logic here
                  console.log('Time filter:', e.target.value)
                }}
              >
                <option value="all">All Matches</option>
                <option value="today">Today</option>
                <option value="tomorrow">Tomorrow</option>
                <option value="week">This Week</option>
                <option value="upcoming">Upcoming</option>
              </select>
            </div>

            {/* Featured Filter */}
            <div className="flex items-end">
              <label className="flex items-center space-x-2 cursor-pointer h-10">
                <input
                  type="checkbox"
                  checked={filters.featured}
                  onChange={(e) => setFilters({ ...filters, featured: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Featured Only</span>
              </label>
            </div>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-gray-600 font-medium">Active filters:</span>
                  {filters.sport && (
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                      Sport: {sports.find(s => s.id === filters.sport)?.name}
                    </span>
                  )}
                  {filters.league && (
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                      League: {leagues.find(l => l.id === filters.league)?.name}
                    </span>
                  )}
                  {filters.featured && (
                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                      Featured
                    </span>
                  )}
                  {filters.searchQuery && (
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                      Search: "{filters.searchQuery}"
                    </span>
                  )}
                </div>
                <button
                  onClick={clearFilters}
                  className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  <FiX size={14} />
                  <span>Clear all</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Filter Tips */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-600">
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span>Open for trading</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
          <span>Featured market</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
          <span>Starting soon</span>
        </div>
      </div>
    </div>
  )
}
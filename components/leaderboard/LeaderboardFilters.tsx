'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FiFilter, FiSearch, FiX } from 'react-icons/fi'

interface LeaderboardFiltersProps {
  searchParams?: { [key: string]: string | string[] | undefined }
}

export default function LeaderboardFilters({ searchParams }: LeaderboardFiltersProps) {
  const router = useRouter()
  const params = useSearchParams()
  
  // Initialize state from URL search params
  const [timeframe, setTimeframe] = useState(params?.get('timeframe') || 'all-time')
  const [searchQuery, setSearchQuery] = useState(params?.get('search') || '')
  const [traderType, setTraderType] = useState(params?.get('type') || 'all')
  const [sortBy, setSortBy] = useState(params?.get('sort') || 'profit')

  // Update URL when filters change
  useEffect(() => {
    const newParams = new URLSearchParams()
    
    if (timeframe && timeframe !== 'all-time') newParams.set('timeframe', timeframe)
    if (searchQuery) newParams.set('search', searchQuery)
    if (traderType && traderType !== 'all') newParams.set('type', traderType)
    if (sortBy && sortBy !== 'profit') newParams.set('sort', sortBy)
    
    const queryString = newParams.toString()
    const newUrl = queryString ? `/dashboard/leaderboard?${queryString}` : '/dashboard/leaderboard'
    
    router.push(newUrl, { scroll: false })
  }, [timeframe, searchQuery, traderType, sortBy, router])

  // Clear all filters
  const clearFilters = () => {
    setTimeframe('all-time')
    setSearchQuery('')
    setTraderType('all')
    setSortBy('profit')
  }

  const hasActiveFilters = timeframe !== 'all-time' || searchQuery || traderType !== 'all' || sortBy !== 'profit'

  return (
    <div className="flex flex-col space-y-3">
      {/* Main Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search traders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <FiX className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {/* Timeframe Filter */}
        <div className="flex items-center space-x-2 min-w-[150px]">
          <FiFilter className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all-time">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
        </div>

        {/* Trader Type Filter */}
        <select
          value={traderType}
          onChange={(e) => setTraderType(e.target.value)}
          className="min-w-[150px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Traders</option>
          <option value="profitable">Profitable Only</option>
          <option value="negative">Negative P&L</option>
          <option value="high-volume">High Volume</option>
          <option value="active">Active Traders</option>
        </select>

        {/* Sort By */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="min-w-[150px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="profit">Sort by Profit</option>
          <option value="win-rate">Sort by Win Rate</option>
          <option value="trades">Sort by Trades</option>
          <option value="volume">Sort by Volume</option>
          <option value="name">Sort by Name</option>
        </select>
      </div>

      {/* Active Filters & Clear Button */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3 border border-blue-200">
          <div className="flex items-center space-x-2 text-sm">
            <span className="text-blue-800 font-medium">Active filters:</span>
            {timeframe !== 'all-time' && (
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                Timeframe: {timeframe.replace('-', ' ')}
              </span>
            )}
            {searchQuery && (
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                Search: "{searchQuery}"
              </span>
            )}
            {traderType !== 'all' && (
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                Type: {traderType.replace('-', ' ')}
              </span>
            )}
            {sortBy !== 'profit' && (
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                Sort: {sortBy.replace('-', ' ')}
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
      )}

      {/* Quick Stats */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-600">
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
          <span>Top 3</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <span>You</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span>Profitable</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
          <span>Negative</span>
        </div>
      </div>
    </div>
  )
}
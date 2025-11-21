'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FiDollarSign, FiUsers, FiTrendingUp, FiActivity, FiBarChart2, FiPieChart } from 'react-icons/fi'

interface AdminStatsProps {
  stats?: any
}

export default function AdminStats({ stats: initialStats }: AdminStatsProps) {
  const [stats, setStats] = useState(initialStats || null)
  const [isLoading, setIsLoading] = useState(!initialStats)
  const supabase = createClient()

  useEffect(() => {
    if (!initialStats) {
      fetchStats()
    }
  }, [])

  const fetchStats = async () => {
    try {
      setIsLoading(true)

      // Fetch all stats in parallel
      const [
        { count: totalUsers },
        { count: totalMarkets },
        { data: markets },
        { data: transactions },
        { data: activePositions },
        { data: liquidityPools }
      ] = await Promise.all([
        // Total users
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true }),
        
        // Total markets
        supabase
          .from('markets')
          .select('*', { count: 'exact', head: true }),
        
        // Markets by status
        supabase
          .from('markets')
          .select('status, total_liquidity'),
        
        // Transaction data
        supabase
          .from('transactions')
          .select('total_amount, total_fees, created_at'),
        
        // Active positions
        supabase
          .from('positions')
          .select('shares_owned')
          .eq('is_active', true)
          .gt('shares_owned', 0),
        
        // Liquidity pools
        supabase
          .from('liquidity_pools')
          .select('total_liquidity, available_liquidity, total_fees_collected')
      ])

      // Calculate stats
      const totalVolume = transactions?.reduce((sum, tx) => sum + (tx.total_amount || 0), 0) || 0
      const totalFees = transactions?.reduce((sum, tx) => sum + (tx.total_fees || 0), 0) || 0
      
      const openMarkets = markets?.filter(m => m.status === 'open').length || 0
      const liveMarkets = markets?.filter(m => m.status === 'live').length || 0
      const closedMarkets = markets?.filter(m => m.status === 'closed').length || 0
      const settledMarkets = markets?.filter(m => m.status === 'settled').length || 0
      
      const totalLiquidity = liquidityPools?.reduce((sum, lp) => sum + (lp.total_liquidity || 0), 0) || 0
      const availableLiquidity = liquidityPools?.reduce((sum, lp) => sum + (lp.available_liquidity || 0), 0) || 0
      const lockedLiquidity = totalLiquidity - availableLiquidity
      const utilizationRate = totalLiquidity > 0 ? ((lockedLiquidity / totalLiquidity) * 100) : 0
      
      const feesCollected = liquidityPools?.reduce((sum, lp) => sum + (lp.total_fees_collected || 0), 0) || 0

      // Get active traders (users with trades in last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const activeTraders = transactions?.filter(tx => 
        new Date(tx.created_at) > thirtyDaysAgo
      ).length || 0

      setStats({
        total_users: totalUsers || 0,
        total_markets: totalMarkets || 0,
        active_markets: openMarkets + liveMarkets,
        open_markets: openMarkets,
        live_markets: liveMarkets,
        closed_markets: closedMarkets,
        settled_markets: settledMarkets,
        total_volume: totalVolume,
        total_fees: totalFees,
        total_liquidity: totalLiquidity,
        available_liquidity: availableLiquidity,
        locked_liquidity: lockedLiquidity,
        utilization_rate: utilizationRate,
        fees_collected: feesCollected,
        active_positions: activePositions?.length || 0,
        active_traders: activeTraders
      })
    } catch (error) {
      console.error('Error fetching admin stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const data = stats || {
    total_users: 0,
    total_markets: 0,
    active_markets: 0,
    total_volume: 0,
    total_fees: 0,
    total_liquidity: 0,
    active_traders: 0
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Platform Overview</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-blue-600">Total Users</div>
                <div className="text-3xl font-bold text-blue-900 mt-1">
                  {data.total_users?.toLocaleString() || '0'}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  {data.active_traders || 0} active this month
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-200 rounded-lg flex items-center justify-center">
                <FiUsers className="text-blue-700" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-green-600">Total Volume</div>
                <div className="text-3xl font-bold text-green-900 mt-1">
                  ${data.total_volume?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  All-time trading volume
                </div>
              </div>
              <div className="w-12 h-12 bg-green-200 rounded-lg flex items-center justify-center">
                <FiDollarSign className="text-green-700" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-purple-600">Total Fees</div>
                <div className="text-3xl font-bold text-purple-900 mt-1">
                  ${data.total_fees?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}
                </div>
                <div className="text-xs text-purple-600 mt-1">
                  ${data.fees_collected?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'} collected
                </div>
              </div>
              <div className="w-12 h-12 bg-purple-200 rounded-lg flex items-center justify-center">
                <FiTrendingUp className="text-purple-700" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-6 border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-orange-600">Active Markets</div>
                <div className="text-3xl font-bold text-orange-900 mt-1">
                  {data.active_markets?.toLocaleString() || '0'}
                </div>
                <div className="text-xs text-orange-600 mt-1">
                  {data.total_markets || 0} total markets
                </div>
              </div>
              <div className="w-12 h-12 bg-orange-200 rounded-lg flex items-center justify-center">
                <FiActivity className="text-orange-700" size={24} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Market Breakdown */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <FiBarChart2 className="text-gray-600 mr-2" size={20} />
            <h4 className="font-medium text-gray-900">Market Breakdown</h4>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span className="text-gray-600">Open Markets</span>
              </div>
              <span className="font-semibold text-gray-900">{data.open_markets || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                <span className="text-gray-600">Live Markets</span>
              </div>
              <span className="font-semibold text-gray-900">{data.live_markets || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                <span className="text-gray-600">Closed Markets</span>
              </div>
              <span className="font-semibold text-gray-900">{data.closed_markets || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-gray-500 rounded-full mr-2"></div>
                <span className="text-gray-600">Settled Markets</span>
              </div>
              <span className="font-semibold text-gray-900">{data.settled_markets || 0}</span>
            </div>
          </div>
        </div>

        {/* Liquidity Stats */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <FiPieChart className="text-gray-600 mr-2" size={20} />
            <h4 className="font-medium text-gray-900">Liquidity Stats</h4>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Liquidity</span>
              <span className="font-semibold text-gray-900">
                ${data.total_liquidity?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Available Liquidity</span>
              <span className="font-semibold text-green-600">
                ${data.available_liquidity?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Locked in Positions</span>
              <span className="font-semibold text-orange-600">
                ${data.locked_liquidity?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Utilization Rate</span>
              <span className="font-semibold text-gray-900">
                {data.utilization_rate?.toFixed(1) || '0'}%
              </span>
            </div>
          </div>
          
          {/* Utilization Progress Bar */}
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-green-500 to-orange-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(data.utilization_rate || 0, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-600">Active Positions</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {data.active_positions?.toLocaleString() || '0'}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-600">Avg Volume per User</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            ${data.total_users > 0 
              ? (data.total_volume / data.total_users).toLocaleString(undefined, { maximumFractionDigits: 0 }) 
              : '0'}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-600">Fee Revenue</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            ${data.fees_collected?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '0'}
          </div>
        </div>
      </div>
    </div>
  )
}
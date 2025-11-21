'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, TradingStats } from '@/types/profile'
import { FiTrendingUp, FiTrendingDown, FiDollarSign, FiAward, FiClock, FiCheckCircle, FiXCircle, FiActivity } from 'react-icons/fi'
import { useAuth } from '@/lib/auth-context'

interface DashboardOverviewProps {
  profile: Profile | null
  tradingStats: TradingStats | null
}

interface ActivityItem {
  id: string
  type: 'transaction' | 'position' | 'order'
  action: string
  amount: number
  shares?: number
  status?: string
  created_at: string
  market?: {
    team_a?: { name: string }
    team_b?: { name: string }
  }
  outcome?: {
    outcome_name: string
  }
  details?: any
}

// Helper types for Supabase responses - updated to handle arrays
interface TransactionData {
  id: string
  transaction_type: string
  total_amount: number
  shares: number
  created_at: string
  market?: Array<{
    team_a: Array<{ name: string }>
    team_b: Array<{ name: string }>
  }>
  outcome?: Array<{ outcome_name: string }>
}

interface PositionData {
  id: string
  shares_owned: number
  total_invested: number
  unrealized_pnl: number
  created_at: string
  is_active: boolean
  market?: Array<{
    team_a: Array<{ name: string }>
    team_b: Array<{ name: string }>
  }>
  outcome?: Array<{ outcome_name: string }>
}

interface OrderData {
  id: string
  order_side: string
  order_status: string
  shares: number
  executed_shares: number
  total_amount: number
  created_at: string
  filled_at: string | null
  market?: Array<{
    team_a: Array<{ name: string }>
    team_b: Array<{ name: string }>
  }>
  outcome?: Array<{ outcome_name: string }>
}

export default function DashboardOverview({ profile, tradingStats }: DashboardOverviewProps) {
  const { user } = useAuth()
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [isLoadingActivity, setIsLoadingActivity] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (user?.id) {
      fetchRecentActivity()
    }
  }, [user])

  // Helper function to safely extract market data from arrays
  const getMarketData = (data: { market?: any }): ActivityItem['market'] => {
    if (!data.market) return undefined
    
    // Handle array responses from Supabase joins - take first element
    const market = Array.isArray(data.market) ? data.market[0] : data.market
    if (!market) return undefined
    
    const teamA = Array.isArray(market.team_a) ? market.team_a[0] : market.team_a
    const teamB = Array.isArray(market.team_b) ? market.team_b[0] : market.team_b
    
    return {
      team_a: teamA ? { name: teamA.name } : undefined,
      team_b: teamB ? { name: teamB.name } : undefined
    }
  }

  // Helper function to safely extract outcome data from arrays
  const getOutcomeData = (data: { outcome?: any }): ActivityItem['outcome'] => {
    if (!data.outcome) return undefined
    
    // Handle array responses from Supabase joins - take first element
    const outcome = Array.isArray(data.outcome) ? data.outcome[0] : data.outcome
    
    return outcome ? { outcome_name: outcome.outcome_name } : undefined
  }

  const fetchRecentActivity = async () => {
    if (!user?.id) return

    try {
      setIsLoadingActivity(true)
      
      // Fetch recent transactions
      const { data: transactions } = await supabase
        .from('transactions')
        .select(`
          id,
          transaction_type,
          total_amount,
          shares,
          created_at,
          market:market_id (
            team_a:team_a_id (name),
            team_b:team_b_id (name)
          ),
          outcome:outcome_id (
            outcome_name
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      // Fetch recent positions (new ones)
      const { data: positions } = await supabase
        .from('positions')
        .select(`
          id,
          shares_owned,
          total_invested,
          unrealized_pnl,
          created_at,
          is_active,
          market:market_id (
            team_a:team_a_id (name),
            team_b:team_b_id (name)
          ),
          outcome:outcome_id (
            outcome_name
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      // Fetch recent trade orders
      const { data: orders } = await supabase
        .from('trade_orders')
        .select(`
          id,
          order_side,
          order_status,
          shares,
          executed_shares,
          total_amount,
          created_at,
          filled_at,
          market:market_id (
            team_a:team_a_id (name),
            team_b:team_b_id (name)
          ),
          outcome:outcome_id (
            outcome_name
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      // Combine all activities
      const activities: ActivityItem[] = []

      // Add transactions
      transactions?.forEach((tx: any) => {
        activities.push({
          id: tx.id,
          type: 'transaction',
          action: tx.transaction_type,
          amount: tx.total_amount,
          shares: tx.shares,
          created_at: tx.created_at,
          market: getMarketData(tx),
          outcome: getOutcomeData(tx)
        })
      })

      // Add positions
      positions?.forEach((pos: any) => {
        activities.push({
          id: pos.id,
          type: 'position',
          action: pos.is_active ? 'position_opened' : 'position_closed',
          amount: pos.is_active ? pos.total_invested : pos.unrealized_pnl,
          shares: pos.shares_owned,
          created_at: pos.created_at,
          market: getMarketData(pos),
          outcome: getOutcomeData(pos),
          details: {
            is_active: pos.is_active,
            unrealized_pnl: pos.unrealized_pnl
          }
        })
      })

      // Add orders
      orders?.forEach((order: any) => {
        activities.push({
          id: order.id,
          type: 'order',
          action: order.order_side,
          amount: order.total_amount,
          shares: order.shares,
          status: order.order_status,
          created_at: order.filled_at || order.created_at,
          market: getMarketData(order),
          outcome: getOutcomeData(order),
          details: {
            executed_shares: order.executed_shares,
            order_status: order.order_status
          }
        })
      })

      // Sort by date and take top 10
      activities.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setRecentActivity(activities.slice(0, 10))
    } catch (error) {
      console.error('Error in fetchRecentActivity:', error)
    } finally {
      setIsLoadingActivity(false)
    }
  }

  const formatKycStatus = (status?: string) => {
    if (!status) return 'Unverified'
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const getActivityIcon = (activity: ActivityItem) => {
    if (activity.type === 'transaction') {
      switch (activity.action) {
        case 'buy':
          return <FiTrendingUp className="text-red-600" size={16} />
        case 'sell':
          return <FiTrendingDown className="text-green-600" size={16} />
        case 'settlement_win':
          return <FiAward className="text-green-600" size={16} />
        case 'settlement_loss':
          return <FiXCircle className="text-gray-600" size={16} />
        default:
          return <FiDollarSign className="text-blue-600" size={16} />
      }
    } else if (activity.type === 'position') {
      return activity.action === 'position_opened' 
        ? <FiActivity className="text-blue-600" size={16} />
        : <FiCheckCircle className="text-gray-600" size={16} />
    } else if (activity.type === 'order') {
      switch (activity.status) {
        case 'filled':
          return <FiCheckCircle className="text-green-600" size={16} />
        case 'partial':
          return <FiClock className="text-yellow-600" size={16} />
        case 'pending':
          return <FiClock className="text-blue-600" size={16} />
        case 'cancelled':
          return <FiXCircle className="text-red-600" size={16} />
        default:
          return <FiDollarSign className="text-gray-600" size={16} />
      }
    }
    return <FiDollarSign className="text-blue-600" size={16} />
  }

  const getActivityColor = (activity: ActivityItem) => {
    if (activity.type === 'transaction') {
      switch (activity.action) {
        case 'buy':
          return 'text-red-600'
        case 'sell':
          return 'text-green-600'
        case 'settlement_win':
          return 'text-green-600'
        case 'settlement_loss':
          return 'text-gray-600'
        default:
          return 'text-blue-600'
      }
    } else if (activity.type === 'position') {
      return activity.details?.is_active ? 'text-blue-600' : 'text-gray-600'
    } else if (activity.type === 'order') {
      switch (activity.status) {
        case 'filled':
          return 'text-green-600'
        case 'partial':
          return 'text-yellow-600'
        case 'pending':
          return 'text-blue-600'
        case 'cancelled':
          return 'text-red-600'
        default:
          return 'text-gray-600'
      }
    }
    return 'text-blue-600'
  }

  const getActivityLabel = (activity: ActivityItem) => {
    if (activity.type === 'transaction') {
      return activity.action.replace('_', ' ')
    } else if (activity.type === 'position') {
      return activity.action === 'position_opened' ? 'Position Opened' : 'Position Closed'
    } else if (activity.type === 'order') {
      const side = activity.action.charAt(0).toUpperCase() + activity.action.slice(1)
      // ✅ Fixed: Safe status handling
      const status = activity.status ? 
        activity.status.charAt(0).toUpperCase() + activity.status.slice(1) : 
        'Unknown'
      return `${side} Order ${status}`
    }
    return 'Activity'
  }

  const getActivityDescription = (activity: ActivityItem) => {
    const marketName = `${activity.market?.team_a?.name || 'Unknown'} vs ${activity.market?.team_b?.name || 'Unknown'}`
    const outcome = activity.outcome?.outcome_name
    
    if (activity.type === 'transaction') {
      return `${outcome || 'Unknown'} • ${activity.shares?.toFixed(2) || '0.00'} shares`
    } else if (activity.type === 'position') {
      if (activity.details?.is_active) {
        return `${outcome || 'Unknown'} • ${activity.shares?.toFixed(2) || '0.00'} shares`
      } else {
        const pnl = activity.details?.unrealized_pnl || 0
        return `${outcome || 'Unknown'} • P&L: ${formatCurrency(pnl)}`
      }
    } else if (activity.type === 'order') {
      const executed = activity.details?.executed_shares || 0
      const total = activity.shares || 0
      return `${outcome || 'Unknown'} • ${executed.toFixed(2)}/${total.toFixed(2)} shares`
    }
    return outcome || marketName
  }

  const getActivityAmount = (activity: ActivityItem) => {
    if (activity.type === 'transaction') {
      const sign = activity.action === 'buy' ? '-' : '+'
      return `${sign}${formatCurrency(Math.abs(activity.amount))}`
    } else if (activity.type === 'position') {
      if (activity.details?.is_active) {
        return formatCurrency(activity.amount)
      } else {
        const pnl = activity.details?.unrealized_pnl || 0
        return `${pnl >= 0 ? '+' : ''}${formatCurrency(pnl)}`
      }
    } else if (activity.type === 'order') {
      return formatCurrency(activity.amount)
    }
    return formatCurrency(activity.amount)
  }

  const stats = [
    {
      name: 'Total Trades',
      value: tradingStats?.total_trades || 0,
      icon: FiDollarSign,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      name: 'Win Rate',
      value: `${tradingStats?.win_rate.toFixed(1) || 0}%`,
      icon: FiTrendingUp,
      color: tradingStats && tradingStats.win_rate >= 50 ? 'text-green-600' : 'text-red-600',
      bgColor: tradingStats && tradingStats.win_rate >= 50 ? 'bg-green-50' : 'bg-red-50'
    },
    {
      name: 'Lifetime P&L',
      value: `$${tradingStats?.lifetime_profit_loss.toFixed(2) || '0.00'}`,
      icon: tradingStats && tradingStats.lifetime_profit_loss >= 0 ? FiTrendingUp : FiTrendingDown,
      color: tradingStats && tradingStats.lifetime_profit_loss >= 0 ? 'text-green-600' : 'text-red-600',
      bgColor: tradingStats && tradingStats.lifetime_profit_loss >= 0 ? 'bg-green-50' : 'bg-red-50'
    },
    {
      name: 'Trader Level',
      value: `Level ${tradingStats?.level || 1}`,
      icon: FiAward,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.name} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className={`text-2xl font-semibold ${stat.color}`}>
                    {stat.value}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            {recentActivity.length > 0 && (
              <a 
                href="/dashboard/portfolio"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View All
              </a>
            )}
          </div>
          
          {isLoadingActivity ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center space-x-3 py-2">
                  <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="text-center py-8">
              <FiClock className="mx-auto text-gray-400 mb-2" size={32} />
              <p className="text-sm text-gray-600">No recent activity</p>
              <p className="text-xs text-gray-400 mt-1">Start trading to see your activity</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {recentActivity.map((activity) => (
                <div 
                  key={`${activity.type}-${activity.id}`} 
                  className="flex items-start space-x-3 py-2 px-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 rounded transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {getActivityIcon(activity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 capitalize truncate">
                          {getActivityLabel(activity)}
                        </p>
                        <p className="text-xs text-gray-600 truncate">
                          {activity.market?.team_a?.name || 'Unknown'} vs {activity.market?.team_b?.name || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {getActivityDescription(activity)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-semibold ${getActivityColor(activity)}`}>
                          {getActivityAmount(activity)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatDate(activity.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trading Eligibility */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Email Verified</span>
              <span className={`px-2 py-1 text-xs rounded-full ${profile?.email_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {profile?.email_verified ? 'Verified' : 'Pending'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Age Verified</span>
              <span className={`px-2 py-1 text-xs rounded-full ${profile?.age_verified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {profile?.age_verified ? 'Verified' : 'Required'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">KYC Status</span>
              <span className={`px-2 py-1 text-xs rounded-full ${
                profile?.kyc_status === 'verified' ? 'bg-green-100 text-green-800' :
                profile?.kyc_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {formatKycStatus(profile?.kyc_status)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Start */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold mb-2">Ready to Start Trading?</h3>
            <p className="text-blue-100 mb-4">
              Explore live markets and make your first trade today.
            </p>
            <a 
              href="/dashboard/markets"
              className="inline-block bg-white text-blue-600 px-6 py-2 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
            >
              Browse Markets
            </a>
          </div>
          <div className="hidden md:block">
            <div className="w-24 h-24 bg-blue-400 rounded-full opacity-20"></div>
          </div>
        </div>
      </div>
    </div>
  )
}
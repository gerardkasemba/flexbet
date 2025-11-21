'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FiTrendingUp, FiTrendingDown, FiClock, FiCheck, FiX, FiDollarSign, FiActivity, FiFileText, FiMenu } from 'react-icons/fi'

interface PortfolioStats {
  totalValue: number
  totalInvested: number
  unrealizedPnl: number
  realizedPnl: number
  totalFees: number
  winRate: number
  activePositions: number
  pendingOrders: number
}

interface Position {
  id: string
  market_id: string
  outcome_id: string
  shares_owned: number
  avg_buy_price: number
  total_invested: number
  current_value: number
  unrealized_pnl: number
  unrealized_pnl_percent: number
  realized_pnl: number
  total_fees_paid: number
  is_active: boolean
  created_at: string
  market?: {
    id: string
    team_a?: { name: string; logo_url?: string }
    team_b?: { name: string; logo_url?: string }
    match_date: string
    status: string
    sport?: { name: string }
  }
  outcome?: {
    outcome_name: string
    outcome_symbol: string
    current_price: number
  }
}

interface PendingOrder {
  id: string
  market_id: string
  outcome_id: string
  order_side: string
  order_status: string
  shares: number
  executed_shares: number
  price_limit: number
  total_amount: number
  executed_amount: number
  created_at: string
  market?: {
    team_a?: { name: string }
    team_b?: { name: string }
    status: string
  }
  outcome?: {
    outcome_name: string
    current_price: number
  }
}

interface Transaction {
  id: string
  transaction_type: string
  shares: number
  price_per_share: number
  total_amount: number
  total_fees: number
  created_at: string
  market?: {
    team_a?: { name: string }
    team_b?: { name: string }
  }
  outcome?: {
    outcome_name: string
  }
}

export default function PortfolioPage() {
  const supabase = createClient()
  const [portfolioStats, setPortfolioStats] = useState<PortfolioStats>({
    totalValue: 0,
    totalInvested: 0,
    unrealizedPnl: 0,
    realizedPnl: 0,
    totalFees: 0,
    winRate: 0,
    activePositions: 0,
    pendingOrders: 0
  })
  const [positions, setPositions] = useState<Position[]>([])
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([])
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'history'>('positions')
  const [positionFilter, setPositionFilter] = useState<'all' | 'active' | 'closed'>('active')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    getCurrentUser()
  }, [])

  useEffect(() => {
    if (userId) {
      fetchPortfolioData()
      setupSubscriptions()
    }
  }, [userId])

  const getCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    } catch (error) {
      console.error('Error getting current user:', error)
    }
  }

  const fetchPortfolioData = async () => {
    if (!userId) return

    try {
      setLoading(true)
      
      // Fetch ALL positions (active and closed)
      const { data: positionsData, error: positionsError } = await supabase
        .from('positions')
        .select(`
          *,
          market:market_id (
            id,
            team_a:team_a_id (name, logo_url),
            team_b:team_b_id (name, logo_url),
            match_date,
            status,
            sport:sport_id (name)
          ),
          outcome:outcome_id (
            outcome_name,
            outcome_symbol,
            current_price
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (positionsError) throw positionsError

      // Fetch pending orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('trade_orders')
        .select(`
          *,
          market:market_id (
            team_a:team_a_id (name),
            team_b:team_b_id (name),
            status
          ),
          outcome:outcome_id (
            outcome_name,
            current_price
          )
        `)
        .eq('user_id', userId)
        .in('order_status', ['pending', 'partial'])
        .order('created_at', { ascending: false })

      if (ordersError) throw ordersError

      // Fetch ALL transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select(`
          *,
          market:market_id (
            team_a:team_a_id (name),
            team_b:team_b_id (name)
          ),
          outcome:outcome_id (outcome_name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (transactionsError) throw transactionsError

      // Calculate portfolio stats
      const stats = calculatePortfolioStats(positionsData || [], ordersData || [])
      setPortfolioStats(stats)
      setPositions(positionsData || [])
      setPendingOrders(ordersData || [])
      setRecentTransactions(transactionsData || [])
    } catch (error) {
      console.error('Error fetching portfolio data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculatePortfolioStats = (positions: Position[], orders: PendingOrder[]): PortfolioStats => {
    const activePositions = positions.filter(p => p.is_active)
    const totalValue = activePositions.reduce((sum, pos) => sum + (pos.current_value || 0), 0)
    const totalInvested = activePositions.reduce((sum, pos) => sum + (pos.total_invested || 0), 0)
    const unrealizedPnl = activePositions.reduce((sum, pos) => sum + (pos.unrealized_pnl || 0), 0)
    const realizedPnl = positions.reduce((sum, pos) => sum + (pos.realized_pnl || 0), 0)
    const totalFees = positions.reduce((sum, pos) => sum + (pos.total_fees_paid || 0), 0)
    
    // Calculate win rate from closed positions with realized PnL
    const closedPositions = positions.filter(pos => !pos.is_active && pos.shares_owned === 0)
    const winningPositions = closedPositions.filter(pos => pos.realized_pnl > 0).length
    const winRate = closedPositions.length > 0 ? (winningPositions / closedPositions.length) * 100 : 0

    return {
      totalValue,
      totalInvested,
      unrealizedPnl,
      realizedPnl,
      totalFees,
      winRate,
      activePositions: activePositions.length,
      pendingOrders: orders.length
    }
  }

  const setupSubscriptions = () => {
    if (!userId) return

    const positionsSubscription = supabase
      .channel('positions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'positions',
          filter: `user_id=eq.${userId}`
        },
        () => fetchPortfolioData()
      )
      .subscribe()

    const ordersSubscription = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trade_orders',
          filter: `user_id=eq.${userId}`
        },
        () => fetchPortfolioData()
      )
      .subscribe()

    const transactionsSubscription = supabase
      .channel('transactions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`
        },
        () => fetchPortfolioData()
      )
      .subscribe()

    const outcomesSubscription = supabase
      .channel('outcomes-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'market_outcomes'
        },
        () => fetchPortfolioData()
      )
      .subscribe()

    return () => {
      positionsSubscription.unsubscribe()
      ordersSubscription.unsubscribe()
      transactionsSubscription.unsubscribe()
      outcomesSubscription.unsubscribe()
    }
  }

  const cancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) return

    try {
      const { error } = await supabase
        .from('trade_orders')
        .update({ order_status: 'cancelled' })
        .eq('id', orderId)
        .eq('user_id', userId)

      if (error) throw error

      alert('Order cancelled successfully')
      fetchPortfolioData()
    } catch (error: any) {
      console.error('Error cancelling order:', error)
      alert(`Failed to cancel order: ${error.message}`)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      open: 'bg-green-100 text-green-800',
      live: 'bg-blue-100 text-blue-800',
      closed: 'bg-gray-100 text-gray-800',
      settled: 'bg-purple-100 text-purple-800'
    }
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    )
  }

  const getOrderStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      partial: 'bg-blue-100 text-blue-800',
      filled: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800'
    }
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    )
  }

  const filteredPositions = positions.filter(pos => {
    if (positionFilter === 'active') return pos.is_active
    if (positionFilter === 'closed') return !pos.is_active
    return true
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Portfolio</h1>
            <p className="text-gray-600 mt-1">Loading your investments...</p>
          </div>
        </div>
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg p-6 border border-gray-200">
                <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-32"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Portfolio</h1>
          <p className="text-gray-600 mt-1">Track your investments and performance</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Portfolio Value</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(portfolioStats.totalValue)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {portfolioStats.activePositions} active position{portfolioStats.activePositions !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FiDollarSign className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Unrealized P&L</div>
              <div className={`text-2xl font-bold mt-1 ${
                portfolioStats.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(portfolioStats.unrealizedPnl)}
              </div>
              <div className={`text-xs mt-1 ${
                portfolioStats.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {portfolioStats.totalInvested > 0 
                  ? formatPercent((portfolioStats.unrealizedPnl / portfolioStats.totalInvested) * 100)
                  : '+0.00%'
                }
              </div>
            </div>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              portfolioStats.unrealizedPnl >= 0 ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {portfolioStats.unrealizedPnl >= 0 ? (
                <FiTrendingUp className="text-green-600" size={24} />
              ) : (
                <FiTrendingDown className="text-red-600" size={24} />
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Realized P&L</div>
              <div className={`text-2xl font-bold mt-1 ${
                portfolioStats.realizedPnl >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(portfolioStats.realizedPnl)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Win rate: {portfolioStats.winRate.toFixed(1)}%
              </div>
            </div>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              portfolioStats.realizedPnl >= 0 ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {portfolioStats.realizedPnl >= 0 ? (
                <FiCheck className="text-green-600" size={24} />
              ) : (
                <FiX className="text-red-600" size={24} />
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Pending Orders</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {portfolioStats.pendingOrders}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Fees paid: {formatCurrency(portfolioStats.totalFees)}
              </div>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <FiClock className="text-yellow-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        {/* Mobile Dropdown */}
        <div className="lg:hidden border-b border-gray-200">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-full flex items-center justify-between px-4 py-4 text-left"
          >
            <div className="flex items-center space-x-2">
              {(() => {
                const activeTabData = [
                  { id: 'positions', name: 'Positions', icon: FiActivity, count: positions.length },
                  { id: 'orders', name: 'Active Orders', icon: FiClock, count: pendingOrders.length },
                  { id: 'history', name: 'History', icon: FiFileText, count: recentTransactions.length }
                ].find(tab => tab.id === activeTab);
                
                if (activeTabData) {
                  const Icon = activeTabData.icon;
                  return (
                    <>
                      <Icon size={18} className="text-blue-600" />
                      <span className="font-medium text-gray-900">{activeTabData.name}</span>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-600">
                        {activeTabData.count}
                      </span>
                    </>
                  );
                }
                return null;
              })()}
            </div>
            <FiMenu 
              className={`text-gray-400 transition-transform ${mobileMenuOpen ? 'rotate-90' : ''}`} 
              size={20} 
            />
          </button>
          
          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div className="border-t border-gray-200 bg-gray-50">
              {[
                { id: 'positions', name: 'Positions', icon: FiActivity, count: positions.length },
                { id: 'orders', name: 'Active Orders', icon: FiClock, count: pendingOrders.length },
                { id: 'history', name: 'History', icon: FiFileText, count: recentTransactions.length }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon size={18} />
                      <span className="font-medium">{tab.name}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      activeTab === tab.id
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Desktop Horizontal Tabs */}
        <div className="hidden lg:block border-b border-gray-200">
          <nav className="flex space-x-8 px-6 overflow-x-auto" aria-label="Tabs">
            {[
              { id: 'positions', name: 'Positions', icon: FiActivity, count: positions.length },
              { id: 'orders', name: 'Active Orders', icon: FiClock, count: pendingOrders.length },
              { id: 'history', name: 'History', icon: FiFileText, count: recentTransactions.length }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon size={18} />
                  <span>{tab.name}</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-4 md:p-6">
          {/* POSITIONS TAB */}
          {activeTab === 'positions' && (
            <div className="space-y-4">
              {/* Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center space-x-2 overflow-x-auto pb-2 sm:pb-0">
                  {['all', 'active', 'closed'].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setPositionFilter(filter as any)}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                        positionFilter === filter
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="text-sm text-gray-500">
                  {filteredPositions.length} position{filteredPositions.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Positions List */}
              {filteredPositions.length === 0 ? (
                <div className="text-center py-12">
                  <FiActivity className="mx-auto text-gray-400 mb-3" size={48} />
                  <p className="text-gray-500">No {positionFilter} positions</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredPositions.map((position) => (
                    <div
                      key={position.id}
                      className="bg-gray-50 rounded-lg p-3 md:p-4 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="font-semibold text-gray-900 text-sm md:text-base">
                              {position.market?.team_a?.name} vs {position.market?.team_b?.name}
                            </span>
                            {getStatusBadge(position.market?.status || 'open')}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-gray-600">
                            <span className="font-medium">{position.outcome?.outcome_name}</span>
                            <span className="hidden sm:inline">•</span>
                            <span>{position.shares_owned.toFixed(4)} shares</span>
                            <span className="hidden sm:inline">•</span>
                            <span>Avg: {formatCurrency(position.avg_buy_price)}</span>
                            <span className="hidden md:inline">•</span>
                            <span className="hidden md:inline">Current: {formatCurrency(position.outcome?.current_price || 0)}</span>
                          </div>
                        </div>
                        <div className="text-left md:text-right">
                          <div className="font-bold text-gray-900">
                            {formatCurrency(position.current_value)}
                          </div>
                          <div className={`text-sm font-medium ${
                            position.unrealized_pnl >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatCurrency(position.unrealized_pnl)} ({formatPercent(position.unrealized_pnl_percent)})
                          </div>
                          {position.realized_pnl !== 0 && (
                            <div className={`text-xs ${
                              position.realized_pnl >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              Realized: {formatCurrency(position.realized_pnl)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ACTIVE ORDERS TAB */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {pendingOrders.length === 0 ? (
                <div className="text-center py-12">
                  <FiClock className="mx-auto text-gray-400 mb-3" size={48} />
                  <p className="text-gray-500">No pending orders</p>
                  <p className="text-sm text-gray-400 mt-1">Your sell orders will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingOrders.map((order) => {
                    const remainingShares = order.shares - (order.executed_shares || 0)
                    const fillPercent = ((order.executed_shares || 0) / order.shares) * 100

                    return (
                      <div
                        key={order.id}
                        className="bg-gray-50 rounded-lg p-3 md:p-4 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  order.order_side === 'buy' ? 'bg-green-500' : 'bg-red-500'
                                }`}></div>
                                <span className="font-semibold text-gray-900 capitalize text-sm md:text-base">
                                  {order.order_side}
                                </span>
                                <span className="text-gray-600 text-sm truncate">
                                  {order.market?.team_a?.name} vs {order.market?.team_b?.name}
                                </span>
                                {getOrderStatusBadge(order.order_status)}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-gray-600">
                                <span>{order.outcome?.outcome_name}</span>
                                <span className="hidden sm:inline">•</span>
                                <span>{remainingShares.toFixed(4)} / {order.shares.toFixed(4)}</span>
                                <span className="hidden sm:inline">•</span>
                                <span>Limit: {formatCurrency(order.price_limit)}</span>
                                <span className="hidden md:inline">•</span>
                                <span className="hidden md:inline text-xs text-gray-500">{formatDate(order.created_at)}</span>
                              </div>
                              {/* Progress bar for partial fills */}
                              {order.order_status === 'partial' && (
                                <div className="mt-2">
                                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                    <span>Filled: {fillPercent.toFixed(1)}%</span>
                                    <span>{formatCurrency(order.executed_amount || 0)} received</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-blue-600 h-2 rounded-full transition-all"
                                      style={{ width: `${fillPercent}%` }}
                                    ></div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                            <div className="font-bold text-gray-900">
                              {formatCurrency(order.total_amount || (order.shares * order.price_limit))}
                            </div>
                            <button
                              onClick={() => cancelOrder(order.id)}
                              className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {recentTransactions.length === 0 ? (
                <div className="text-center py-12">
                  <FiFileText className="mx-auto text-gray-400 mb-3" size={48} />
                  <p className="text-gray-500">No transaction history</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="bg-gray-50 rounded-lg p-3 md:p-4 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            transaction.transaction_type === 'buy' 
                              ? 'bg-red-100 text-red-600' 
                              : 'bg-green-100 text-green-600'
                          }`}>
                            {transaction.transaction_type === 'buy' ? (
                              <FiTrendingUp size={16} />
                            ) : (
                              <FiTrendingDown size={16} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900 capitalize text-sm md:text-base">
                                {transaction.transaction_type}
                              </span>
                              <span className="text-gray-600 text-sm truncate">
                                {transaction.market?.team_a?.name} vs {transaction.market?.team_b?.name}
                              </span>
                            </div>
                            <div className="text-xs md:text-sm text-gray-500">
                              <span>{transaction.outcome?.outcome_name}</span>
                              <span className="hidden sm:inline"> • {transaction.shares?.toFixed(4)} shares @ {formatCurrency(transaction.price_per_share || 0)}</span>
                              <span className="hidden md:inline"> • {formatDate(transaction.created_at)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className={`font-bold text-sm md:text-base ${
                            transaction.transaction_type === 'buy' ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {transaction.transaction_type === 'buy' ? '-' : '+'}{formatCurrency(Math.abs(transaction.total_amount))}
                          </div>
                          <div className="text-xs text-gray-500">
                            Fee: {formatCurrency(transaction.total_fees)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
'use client'

import { PublicProfile } from '@/types/profile'
import { FiAward, FiTrendingUp, FiTrendingDown, FiUser } from 'react-icons/fi'

interface LeaderboardTableProps {
  data: PublicProfile[]
  currentUserId?: string
}

export default function LeaderboardTable({ data, currentUserId }: LeaderboardTableProps) {
  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-yellow-100 border-yellow-200'
      case 2: return 'bg-gray-100 border-gray-200'
      case 3: return 'bg-orange-100 border-orange-200'
      default: return 'bg-white border-gray-200'
    }
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <FiAward className="text-yellow-600" size={20} />
      case 2: return <FiAward className="text-gray-600" size={20} />
      case 3: return <FiAward className="text-orange-600" size={20} />
      default: return <span className="text-sm font-medium text-gray-500">#{rank}</span>
    }
  }

  const getProfitColor = (profit: number) => {
    return profit >= 0 ? 'text-green-600' : 'text-red-600'
  }

  const getProfitIcon = (profit: number) => {
    return profit >= 0 ? <FiTrendingUp size={16} /> : <FiTrendingDown size={16} />
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `$${(num / 1000).toFixed(1)}K`
    }
    return `$${num.toFixed(2)}`
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Rank
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Trader
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Lifetime P&L
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Win Rate
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Trades
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Level
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((user, index) => {
            const rank = index + 1
            const isCurrentUser = user.id === currentUserId
            const rowColor = isCurrentUser ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
            
            return (
              <tr 
                key={user.id} 
                className={`hover:bg-gray-50 transition-colors ${rowColor} ${getRankColor(rank)} border-b`}
              >
                {/* Rank */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    {getRankIcon(rank)}
                    {rank > 3 && (
                      <span className="text-sm font-medium text-gray-900">#{rank}</span>
                    )}
                  </div>
                </td>

                {/* Trader */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {user.avatar_url ? (
                        <img
                          className="h-8 w-8 rounded-full"
                          src={user.avatar_url}
                          alt={user.username}
                        />
                      ) : (
                        <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">
                          {user.username}
                        </span>
                        {isCurrentUser && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        Joined {new Date(user.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Lifetime P&L */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={`flex items-center space-x-1 ${getProfitColor(user.lifetime_profit_loss)}`}>
                    {getProfitIcon(user.lifetime_profit_loss)}
                    <span className="text-sm font-medium">
                      {formatNumber(user.lifetime_profit_loss)}
                    </span>
                  </div>
                </td>

                {/* Win Rate */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ width: `${Math.min(user.win_rate, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-900 font-medium">
                      {user.win_rate.toFixed(1)}%
                    </span>
                  </div>
                </td>

                {/* Total Trades */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900 font-medium">
                    {user.total_trades.toLocaleString()}
                  </span>
                </td>

                {/* Level */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <div className="bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                      {user.level}
                    </div>
                    <span className="text-sm text-gray-600">Level</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Empty State */}
      {data.length === 0 && (
        <div className="text-center py-12">
          <FiUser className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No traders found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by making your first trade to appear on the leaderboard.
          </p>
        </div>
      )}
    </div>
  )
}
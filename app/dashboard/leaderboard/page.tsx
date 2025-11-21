import { createClient } from '@/lib/supabase/server'
import { getLeaderboard } from '@/lib/profile-utils'
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable'
import LeaderboardFilters from '@/components/leaderboard/LeaderboardFilters'
import { FiAward, FiTrendingUp, FiUsers, FiStar } from 'react-icons/fi'

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // ✅ Await the searchParams Promise
  const params = await searchParams
  
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  // Get leaderboard data
  const leaderboardData = await getLeaderboard(100)
  const currentUserRank = leaderboardData.findIndex(user => user.id === session?.user?.id) + 1
  const currentUser = session?.user ? leaderboardData.find(user => user.id === session?.user?.id) : null

  // Stats for the header
  const stats = [
    {
      name: 'Your Rank',
      value: currentUserRank > 0 ? `#${currentUserRank}` : 'Unranked',
      icon: FiAward,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      name: 'Total Traders',
      value: leaderboardData.length.toLocaleString(),
      icon: FiUsers,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      name: 'Top Profit',
      value: leaderboardData[0] ? `$${leaderboardData[0].lifetime_profit_loss.toFixed(2)}` : '$0.00',
      icon: FiTrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      name: 'Avg Win Rate',
      value: `${(leaderboardData.reduce((acc, user) => acc + user.win_rate, 0) / leaderboardData.length || 0).toFixed(1)}%`,
      icon: FiStar,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leaderboard</h1>
          <p className="text-gray-600 mt-1">
            Compete with the best traders on FlexBet
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          {/* ✅ Pass the params to your filters component */}
          <LeaderboardFilters searchParams={params} />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.name} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className={`text-lg font-semibold ${stat.color}`}>
                    {stat.value}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Current User Highlight */}
      {currentUser && currentUserRank > 0 && (
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 rounded-full p-2">
                <FiAward size={24} />
              </div>
              <div>
                <p className="font-semibold">You're ranked #{currentUserRank}</p>
                <p className="text-blue-100 text-sm">
                  ${currentUser.lifetime_profit_loss.toFixed(2)} lifetime profit • {currentUser.win_rate.toFixed(1)}% win rate
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">#{currentUserRank}</p>
              <p className="text-blue-100 text-sm">Rank</p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <LeaderboardTable 
          data={leaderboardData} 
          currentUserId={session?.user?.id} 
        />
      </div>

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
            <span>Top 3 Traders</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Your Position</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Profitable Traders</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Negative P&L</span>
          </div>
        </div>
      </div>
    </div>
  )
}
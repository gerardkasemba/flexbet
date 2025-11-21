import { createClient } from '@/lib/supabase/server'
import MarketsGrid from '@/components/markets/MarketsGrid'
import MarketsFilters from '@/components/markets/MarketsFilters'
import { FiTrendingUp, FiClock, FiAward } from 'react-icons/fi'

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  
  const supabase = await createClient()

  // Get all active markets with their outcomes
  // ✅ Changed: Show markets until they are settled (settled_at is set)
  const { data: markets, error } = await supabase
    .from('markets')
    .select(`
      *,
      sport: sports(name, code),
      league: leagues(name, country_code),
      team_a:teams!markets_team_a_id_fkey(name, short_name, logo_url),
      team_b:teams!markets_team_b_id_fkey(name, short_name, logo_url),
      home_team:teams!markets_home_team_id_fkey(name),
      market_outcomes(
        id,
        outcome_type,
        outcome_name,
        current_price,
        total_shares,
        volume_24h,
        price_change_24h
      )
    `)
    .in('status', ['open', 'live', 'suspended', 'closed']) // ✅ Show open, live, suspended, and closed games
    .is('settled_at', null) // ✅ Only exclude games that have been settled
    .eq('trading_enabled', true)
    .order('status', { ascending: false }) // ✅ Live games first
    .order('match_date', { ascending: true })
    .order('is_featured', { ascending: false })

  if (error) {
    console.error('Error fetching markets:', error)
  }

  const activeMarkets = markets || []

  // Get market stats
  const stats = [
    {
      name: 'Active Markets',
      value: activeMarkets.length.toString(),
      icon: FiTrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      name: 'Live Now',
      value: activeMarkets.filter(m => m.status === 'live').length.toString(),
      icon: FiClock,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      name: 'Featured',
      value: activeMarkets.filter(m => m.is_featured).length.toString(),
      icon: FiAward,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trading Markets</h1>
          <p className="text-gray-600 mt-1">
            Buy and sell shares in live sports events
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          {/* <MarketsFilters searchParams={params} /> */}
        </div>
      </div>

      {/* Stats */}
      {/* <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  <p className="text-lg font-semibold text-gray-900">
                    {stat.value}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div> */}

      {/* Markets Grid */}
      <MarketsGrid 
        markets={activeMarkets} 
        searchParams={params}
      />

      {/* Empty State */}
      {activeMarkets.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <FiTrendingUp className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No markets available</h3>
          <p className="mt-2 text-gray-600">
            Check back later for new trading opportunities.
          </p>
        </div>
      )}
    </div>
  )
}
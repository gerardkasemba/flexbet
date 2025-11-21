import { createClient } from '@/lib/supabase/server'
import { getProfile, getTradingStats } from '@/lib/profile-utils'
import DashboardOverview from '@/components/dashboard/DashboardOverview'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return null
  }

  const profile = await getProfile(session.user.id)
  const tradingStats = await getTradingStats(session.user.id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">
            Welcome back, {profile?.username || 'Trader'}! Ready to make some moves?
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">Available Balance</div>
          <div className="text-2xl font-bold text-gray-900">
            ${profile?.balance.toFixed(2) || '0.00'}
          </div>
        </div>
      </div>

      <DashboardOverview 
        profile={profile} 
        tradingStats={tradingStats} 
      />
    </div>
  )
}
import { createClient } from '@/lib/supabase/server'
import { isUserAdmin } from '@/lib/admin-utils'
import { redirect } from 'next/navigation'
import AdminTabs from '@/components/admin/AdminTabs'

export default async function AdminPage() {
  const supabase = await createClient()
  
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/')
  }

  const isAdmin = await isUserAdmin(session.user.id)

  if (!isAdmin) {
    redirect('/dashboard')
  }

  // Fetch data for different tabs
  const [
    { data: markets },
    { data: users }
  ] = await Promise.all([
    // Markets for CloseMarketForm
    supabase
      .from('markets')
      .select(`
        id,
        match_date,
        status,
        total_liquidity,
        sport:sport_id (name),
        team_a:team_a_id (name, logo_url),
        team_b:team_b_id (name, logo_url),
        market_outcomes (
          id,
          outcome_name,
          outcome_type,
          total_shares,
          current_price,
          reserve
        )
      `)
      .order('match_date', { ascending: true }),
    
    // Users for UserManagement
    supabase
      .from('profiles')
      .select('id, username, email, balance, created_at, is_admin')
      .order('created_at', { ascending: false })
      .limit(100)
  ])

  // Calculate basic stats from markets data
  const stats = {
    total_users: users?.length || 0,
    total_markets: markets?.length || 0,
    active_markets: markets?.filter(m => m.status === 'open' || m.status === 'live').length || 0,
    open_markets: markets?.filter(m => m.status === 'open').length || 0,
    live_markets: markets?.filter(m => m.status === 'live').length || 0,
    closed_markets: markets?.filter(m => m.status === 'closed').length || 0,
    settled_markets: markets?.filter(m => m.status === 'settled').length || 0,
    total_volume: 0, // Will calculate with transactions later
    total_fees: 0, // Will calculate with transactions later
    total_liquidity: markets?.reduce((sum, m) => sum + (m.total_liquidity || 0), 0) || 0,
    available_liquidity: 0,
    locked_liquidity: 0,
    utilization_rate: 0
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Manage your FlexBet platform
          </p>
        </div>
        <div className="flex items-center space-x-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
          <span>Admin Mode</span>
        </div>
      </div>

      <AdminTabs 
        markets={markets || []} 
        users={users || []}
        stats={stats}
        userId={session.user.id}
      />
    </div>
  )
}
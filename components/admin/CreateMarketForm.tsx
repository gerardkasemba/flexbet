'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AMMCalculator } from '@/lib/amm/calculator'
import { FiPlus, FiX, FiDollarSign, FiCalendar, FiUsers, FiAward, FiGlobe } from 'react-icons/fi'

interface Sport {
  id: string
  name: string
  code: string
}

interface League {
  id: string
  name: string
  sport_id: string
  country_code?: string
}

interface Team {
  id: string
  name: string
  short_name: string
  country_code?: string
  logo_url?: string
}

interface MarketFormData {
  sportId: string
  leagueId: string
  teamAId: string
  teamBId: string
  matchDate: string
  matchTime: string
  venueType: 'home_away' | 'neutral'
  homeTeamId: string
  initialLiquidity: number
  liquidityFee: number
  isFeatured: boolean
}

export default function CreateMarketForm() {
  const [sports, setSports] = useState<Sport[]>([])
  const [leagues, setLeagues] = useState<League[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [filteredLeagues, setFilteredLeagues] = useState<League[]>([])
  const [filteredTeams, setFilteredTeams] = useState<Team[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<MarketFormData>({
    sportId: '',
    leagueId: '',
    teamAId: '',
    teamBId: '',
    matchDate: '',
    matchTime: '',
    venueType: 'home_away',
    homeTeamId: '',
    initialLiquidity: 30000,
    liquidityFee: 0.03,
    isFeatured: false
  })

  const supabase = createClient()

  useEffect(() => {
    loadInitialData()
  }, [])

  // Filter leagues when sport changes
  useEffect(() => {
    if (formData.sportId) {
      const filtered = leagues.filter(league => league.sport_id === formData.sportId)
      setFilteredLeagues(filtered)
      
      setFormData(prev => ({ 
        ...prev, 
        leagueId: '',
        teamAId: '',
        teamBId: '',
        homeTeamId: ''
      }))
      setFilteredTeams([])
    } else {
      setFilteredLeagues([])
      setFilteredTeams([])
    }
  }, [formData.sportId, leagues])

  // Filter teams when league changes
  useEffect(() => {
    if (formData.leagueId) {
      const selectedLeague = leagues.find(league => league.id === formData.leagueId)
      if (selectedLeague?.country_code) {
        const filtered = teams.filter(team => team.country_code === selectedLeague.country_code)
        setFilteredTeams(filtered)
      } else {
        setFilteredTeams(teams)
      }
      
      setFormData(prev => ({ 
        ...prev, 
        teamAId: '',
        teamBId: '',
        homeTeamId: ''
      }))
    } else {
      setFilteredTeams([])
    }
  }, [formData.leagueId, leagues, teams])

  const loadInitialData = async () => {
    try {
      setIsLoading(true)
      const [sportsRes, leaguesRes, teamsRes] = await Promise.all([
        supabase.from('sports').select('*').order('name'),
        supabase.from('leagues').select('*').order('name'),
        supabase.from('teams').select('*').order('name')
      ])

      if (sportsRes.data) setSports(sportsRes.data)
      if (leaguesRes.data) setLeagues(leaguesRes.data)
      if (teamsRes.data) setTeams(teamsRes.data)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Validate form
      if (!formData.teamAId || !formData.teamBId || formData.teamAId === formData.teamBId) {
        alert('Please select two different teams')
        return
      }

      if (!formData.matchDate || !formData.matchTime) {
        alert('Please select match date and time')
        return
      }

      // Get team details
      const teamA = getAvailableTeams().find(t => t.id === formData.teamAId)
      const teamB = getAvailableTeams().find(t => t.id === formData.teamBId)
      const homeTeam = formData.venueType === 'home_away' ? getAvailableTeams().find(t => t.id === formData.homeTeamId) : null

      if (!teamA || !teamB) {
        alert('Invalid team selection')
        return
      }

      // Create market record
      const matchDateTime = new Date(`${formData.matchDate}T${formData.matchTime}`)
      
      const liquidityPerOutcome = formData.initialLiquidity / 3
      
      const { data: market, error: marketError } = await supabase
        .from('markets')
        .insert({
          sport_id: formData.sportId,
          league_id: formData.leagueId,
          team_a_id: formData.teamAId,
          team_b_id: formData.teamBId,
          match_date: matchDateTime.toISOString(),
          venue_type: formData.venueType,
          home_team_id: homeTeam?.id || null,
          market_type: 'multi_choice', // ✅ Always multi_choice (3 outcomes: home/draw/away)
          total_liquidity: formData.initialLiquidity,
          k_constant: liquidityPerOutcome * liquidityPerOutcome,
          liquidity_fee: formData.liquidityFee,
          created_by: (await supabase.auth.getUser()).data.user?.id,
          trading_enabled: true,
          is_featured: formData.isFeatured,
          status: 'open'
        })
        .select()
        .single()

      if (marketError) throw marketError

      // Create outcomes - always 3 outcomes (home/draw/away)
      const outcomeConfigs = [
        { type: 'home_win', name: homeTeam ? `${homeTeam.name} Win` : `${teamA.name} Win`, symbol: 'HOME_WIN' },
        { type: 'draw', name: 'Draw', symbol: 'DRAW' },
        { type: 'away_win', name: homeTeam ? `${homeTeam.id === teamA.id ? teamB.name : teamA.name} Win` : `${teamB.name} Win`, symbol: 'AWAY_WIN' }
      ]

      const initialPrice = 1.0 / 3
      const outcomes = outcomeConfigs.map((config, index) => ({
        market_id: market.id,
        outcome_type: config.type,
        outcome_name: config.name,
        outcome_symbol: config.symbol,
        total_shares: liquidityPerOutcome,
        reserve: liquidityPerOutcome,
        current_price: Number(initialPrice.toFixed(6)),
        volume_24h: 0,
        display_order: index,
        color_hex: getTeamColor(config.type, teamA, teamB)
      }))

      const { error: outcomesError } = await supabase
        .from('market_outcomes')
        .insert(outcomes)

      if (outcomesError) throw outcomesError

      const kConstant = liquidityPerOutcome * liquidityPerOutcome
      
      const { error: poolError } = await supabase
        .from('liquidity_pools')
        .insert({
          market_id: market.id,
          total_liquidity: formData.initialLiquidity,
          utilized_liquidity: 0,
          available_liquidity: formData.initialLiquidity,
          k_constant: kConstant,
          fee_rate: formData.liquidityFee,
          total_fees_collected: 0,
          daily_volume: 0
        })

      if (poolError) throw poolError

      alert('Market created successfully!')
      
      // Reset form
      setFormData({
        sportId: '',
        leagueId: '',
        teamAId: '',
        teamBId: '',
        matchDate: '',
        matchTime: '',
        venueType: 'home_away',
        homeTeamId: '',
        initialLiquidity: 30000,
        liquidityFee: 0.03,
        isFeatured: false
      })

    } catch (error) {
      console.error('Error creating market:', error)
      
      let errorMessage = 'Failed to create market'
      if (error instanceof Error) {
        errorMessage = `Failed to create market: ${error.message}`
      } else if (typeof error === 'string') {
        errorMessage = `Failed to create market: ${error}`
      } else {
        errorMessage = 'Failed to create market: An unknown error occurred'
      }
      
      alert(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const getTeamColor = (outcomeType: string, teamA: Team, teamB: Team): string => {
    const colors: { [key: string]: string } = {
      'home_win': '#DA291C',
      'away_win': '#EF0107',
      'draw': '#95BF47'
    }
    return colors[outcomeType] || '#6B7280'
  }

  const getAvailableTeams = () => {
    return filteredTeams.length > 0 ? filteredTeams : teams
  }

  const getSelectedSportName = () => {
    return sports.find(sport => sport.id === formData.sportId)?.name || 'Sport'
  }

  const getSelectedLeagueName = () => {
    return leagues.find(league => league.id === formData.leagueId)?.name || 'League'
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Create New Market</h2>
            <p className="text-gray-600 mt-1">
              Set up a new sports trading market with AMM liquidity
            </p>
          </div>
          <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            <FiAward className="mr-1" size={14} />
            AMM Enabled
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Sport & League Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FiGlobe className="inline mr-1" />
                Sport *
              </label>
              <select
                value={formData.sportId}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  sportId: e.target.value, 
                  leagueId: '',
                  teamAId: '',
                  teamBId: '',
                  homeTeamId: ''
                })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select Sport</option>
                {sports.map(sport => (
                  <option key={sport.id} value={sport.id}>
                    {sport.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                League *
              </label>
              <select
                value={formData.leagueId}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  leagueId: e.target.value,
                  teamAId: '',
                  teamBId: '',
                  homeTeamId: ''
                })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={!formData.sportId}
              >
                <option value="">Select League</option>
                {filteredLeagues.map(league => (
                  <option key={league.id} value={league.id}>
                    {league.name}
                  </option>
                ))}
              </select>
              {formData.sportId && filteredLeagues.length === 0 && (
                <p className="text-xs text-orange-600 mt-1">
                  No leagues found for {getSelectedSportName()}
                </p>
              )}
            </div>
          </div>

          {/* Team Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Team A *
              </label>
              <select
                value={formData.teamAId}
                onChange={(e) => setFormData({ ...formData, teamAId: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={!formData.leagueId}
              >
                <option value="">Select Team A</option>
                {getAvailableTeams().map(team => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              {formData.leagueId && getAvailableTeams().length === 0 && (
                <p className="text-xs text-orange-600 mt-1">
                  No teams found for {getSelectedLeagueName()}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Team B *
              </label>
              <select
                value={formData.teamBId}
                onChange={(e) => setFormData({ ...formData, teamBId: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={!formData.leagueId}
              >
                <option value="">Select Team B</option>
                {getAvailableTeams().map(team => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Venue Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Venue Type *
            </label>
            <div className="flex space-x-6">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  value="home_away"
                  checked={formData.venueType === 'home_away'}
                  onChange={(e) => setFormData({ ...formData, venueType: e.target.value as 'home_away' | 'neutral', homeTeamId: '' })}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <FiUsers className="text-gray-400" size={18} />
                <span className="text-sm font-medium">Home & Away</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  value="neutral"
                  checked={formData.venueType === 'neutral'}
                  onChange={(e) => setFormData({ ...formData, venueType: e.target.value as 'home_away' | 'neutral', homeTeamId: '' })}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <FiGlobe className="text-gray-400" size={18} />
                <span className="text-sm font-medium">Neutral Venue</span>
              </label>
            </div>
          </div>

          {/* Home Team Selection (only for home_away) */}
          {formData.venueType === 'home_away' && formData.teamAId && formData.teamBId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Home Team *
              </label>
              <select
                value={formData.homeTeamId}
                onChange={(e) => setFormData({ ...formData, homeTeamId: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select Home Team</option>
                <option value={formData.teamAId}>
                  {getAvailableTeams().find(t => t.id === formData.teamAId)?.name} (Home)
                </option>
                <option value={formData.teamBId}>
                  {getAvailableTeams().find(t => t.id === formData.teamBId)?.name} (Home)
                </option>
              </select>
            </div>
          )}

          {/* Match Date & Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FiCalendar className="inline mr-1" />
                Match Date *
              </label>
              <input
                type="date"
                value={formData.matchDate}
                onChange={(e) => setFormData({ ...formData, matchDate: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Match Time *
              </label>
              <input
                type="time"
                value={formData.matchTime}
                onChange={(e) => setFormData({ ...formData, matchTime: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          {/* AMM Configuration */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-4 flex items-center">
              <FiDollarSign className="mr-2" />
              AMM Configuration
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-2">
                  Initial Liquidity Pool ($)
                </label>
                <input
                  type="number"
                  value={formData.initialLiquidity}
                  onChange={(e) => setFormData({ ...formData, initialLiquidity: Number(e.target.value) })}
                  className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  min="3000"
                  max="300000"
                  step="1000"
                />
                <p className="text-xs text-blue-600 mt-1">
                  Total liquidity split evenly across outcomes ($3,000 - $300,000)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-700 mb-2">
                  Trading Fee (%)
                </label>
                <input
                  type="number"
                  value={formData.liquidityFee * 100}
                  onChange={(e) => setFormData({ ...formData, liquidityFee: Number(e.target.value) / 100 })}
                  className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  min="1"
                  max="10"
                  step="0.1"
                />
                <p className="text-xs text-blue-600 mt-1">
                  Platform fee percentage (1% - 10%)
                </p>
              </div>
            </div>
          </div>

          {/* Featured Market Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Featured Market
              </label>
              <p className="text-xs text-gray-500">
                Highlight this market on the homepage and give it priority visibility
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isFeatured}
                onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Market Preview */}
          {formData.teamAId && formData.teamBId && (
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <h3 className="font-semibold text-green-900 mb-3">Market Preview</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-white rounded border border-green-200">
                  <p className="font-semibold text-green-800">Match</p>
                  <p className="text-sm text-green-600">
                    {getAvailableTeams().find(t => t.id === formData.teamAId)?.name} vs {getAvailableTeams().find(t => t.id === formData.teamBId)?.name}
                  </p>
                </div>
                <div className="text-center p-3 bg-white rounded border border-green-200">
                  <p className="font-semibold text-green-800">Type</p>
                  <p className="text-sm text-green-600">
                    Multi-choice (3 outcomes)
                  </p>
                </div>
                <div className="text-center p-3 bg-white rounded border border-green-200">
                  <p className="font-semibold text-green-800">Initial Prices</p>
                  <p className="text-sm text-green-600">
                    33% / 33% / 33%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isLoading || !formData.teamAId || !formData.teamBId || !formData.matchDate || !formData.matchTime}
              className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Creating Market...</span>
                </>
              ) : (
                <>
                  <FiPlus size={18} />
                  <span>Create Market</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
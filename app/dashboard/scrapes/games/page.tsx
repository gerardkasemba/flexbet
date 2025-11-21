'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { FiCalendar, FiMapPin, FiSave, FiCheckCircle } from 'react-icons/fi';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Sport {
  id: string;
  name: string;
  code: string;
}

interface League {
  id: string;
  sport_id: string;
  name: string;
  country_code: string;
}

interface Team {
  id: string;
  name: string;
  short_name: string;
}

interface ESPNGame {
  id: string;
  date: string;
  name: string;
  shortName: string;
  competitions: Array<{
    id: string;
    date: string;
    neutralSite: boolean;
    competitors: Array<{
      id: string;
      team: {
        id: string;
        displayName: string;
        abbreviation: string;
        logo: string;
      };
      homeAway: 'home' | 'away';
    }>;
    venue?: {
      fullName: string;
    };
  }>;
  status: {
    type: {
      name: string;
      state: string;
    };
  };
}

interface ScrapedGame {
  espnId: string;
  date: string;
  homeTeam: {
    espnId: string;
    name: string;
    abbreviation: string;
  };
  awayTeam: {
    espnId: string;
    name: string;
    abbreviation: string;
  };
  venue: string;
  isNeutralSite: boolean;
  status: string;
}

export default function GameScraper() {
  const [sports, setSports] = useState<Sport[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedSport, setSelectedSport] = useState<string>('');
  const [selectedLeague, setSelectedLeague] = useState<string>('');
  const [scrapedGames, setScrapedGames] = useState<ScrapedGame[]>([]);
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Initial liquidity settings
  const [initialLiquidity, setInitialLiquidity] = useState(30000);
  const [liquidityFee, setLiquidityFee] = useState(0.03);

  useEffect(() => {
    fetchSports();
    fetchTeams();
  }, []);

  useEffect(() => {
    if (selectedSport) {
      fetchLeagues(selectedSport);
    } else {
      setLeagues([]);
    }
  }, [selectedSport]);

  const fetchSports = async () => {
    const { data, error } = await supabase
      .from('sports')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching sports:', error);
      setMessage('Error loading sports');
    } else {
      setSports(data || []);
    }
  };

  const fetchLeagues = async (sportId: string) => {
    const { data, error } = await supabase
      .from('leagues')
      .select('*')
      .eq('sport_id', sportId)
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching leagues:', error);
      setMessage('Error loading leagues');
    } else {
      setLeagues(data || []);
    }
  };

  const fetchTeams = async () => {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching teams:', error);
    } else {
      setTeams(data || []);
    }
  };

  const getESPNLeagueCode = (sportCode: string, leagueName: string): string => {
    const sportCodeMap: { [key: string]: string } = {
      'SOC': 'soccer',
      'BAS': 'basketball',
      'AMF': 'football',
      'CRI': 'cricket',
      'RUG': 'rugby',
      'TEN': 'tennis',
      'BASE': 'baseball',
      'HOC': 'hockey',
    };

    const espnSportCode = sportCodeMap[sportCode.toUpperCase()] || sportCode.toLowerCase();

    const mappings: { [key: string]: { [key: string]: string } } = {
      soccer: {
        'English Premier League': 'eng.1',
        'La Liga': 'esp.1',
        'Serie A': 'ita.1',
        'Bundesliga': 'ger.1',
        'Ligue 1': 'fra.1',
        'Primeira Liga': 'por.1',
        'Eredivisie': 'ned.1',
        'EFL Championship': 'eng.2',
        'UEFA Champions League': 'uefa.champions',
        'UEFA Europa League': 'uefa.europa',
        'UEFA Conference League': 'uefa.europa.conf',
        'MLS (Major League Soccer)': 'usa.1',
        'Liga MX': 'mex.1',
        'Brazil Serie A': 'bra.1',
        'Argentina Primera División': 'arg.1',
        'Saudi Pro League': 'sau.1',
        'Egyptian Premier League': 'egy.1',
        'South African Premier Division (PSL / DStv Premiership)': 'rsa.1',
      },
      basketball: {
        'NBA': 'nba',
        'EuroLeague': 'euroleague',
      },
      // Add more sports mappings as needed
    };

    return mappings[espnSportCode]?.[leagueName] || '';
  };

  const scrapeGames = async () => {
    if (!selectedSport || !selectedLeague) {
      setMessage('Please select both sport and league');
      return;
    }

    setLoading(true);
    setMessage('');
    setScrapedGames([]);
    setSelectedGames(new Set());

    try {
      const sport = sports.find(s => s.id === selectedSport);
      const league = leagues.find(l => l.id === selectedLeague);

      if (!sport || !league) {
        throw new Error('Invalid sport or league selection');
      }

      const sportCodeMap: { [key: string]: string } = {
        'SOC': 'soccer',
        'BAS': 'basketball',
        'AMF': 'football',
      };

      const espnSportCode = sportCodeMap[sport.code.toUpperCase()] || sport.code.toLowerCase();
      const espnLeagueCode = getESPNLeagueCode(sport.code, league.name);

      if (!espnLeagueCode) {
        throw new Error(`No ESPN mapping found for ${sport.name} - ${league.name}`);
      }

      // Fetch scoreboard (includes upcoming games)
      const url = `https://site.api.espn.com/apis/site/v2/sports/${espnSportCode}/${espnLeagueCode}/scoreboard`;
      console.log('Fetching games from:', url);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('ESPN API Response:', data);

      const events: ESPNGame[] = data.events || [];

      if (events.length === 0) {
        throw new Error('No games found for this league');
      }

      // Filter for upcoming games only
      const upcomingGames = events.filter((event: ESPNGame) => {
        const status = event.status?.type?.state;
        return status === 'pre'; // Only get games that haven't started
      });

      if (upcomingGames.length === 0) {
        throw new Error('No upcoming games found for this league');
      }

      // Transform ESPN data to our format
      const games: ScrapedGame[] = upcomingGames.map((event: ESPNGame) => {
        const competition = event.competitions[0];
        const homeCompetitor = competition.competitors.find(c => c.homeAway === 'home');
        const awayCompetitor = competition.competitors.find(c => c.homeAway === 'away');

        return {
          espnId: event.id,
          date: competition.date,
          homeTeam: {
            espnId: homeCompetitor?.team.id || '',
            name: homeCompetitor?.team.displayName || '',
            abbreviation: homeCompetitor?.team.abbreviation || ''
          },
          awayTeam: {
            espnId: awayCompetitor?.team.id || '',
            name: awayCompetitor?.team.displayName || '',
            abbreviation: awayCompetitor?.team.abbreviation || ''
          },
          venue: competition.venue?.fullName || 'TBD',
          isNeutralSite: competition.neutralSite || false,
          status: event.status?.type?.name || 'Scheduled'
        };
      });

      setScrapedGames(games);
      setMessage(`Found ${games.length} upcoming games`);
    } catch (error) {
      console.error('Error scraping games:', error);
      setMessage(error instanceof Error ? error.message : 'Error scraping games');
    } finally {
      setLoading(false);
    }
  };

  const toggleGameSelection = (espnId: string) => {
    const newSelection = new Set(selectedGames);
    if (newSelection.has(espnId)) {
      newSelection.delete(espnId);
    } else {
      newSelection.add(espnId);
    }
    setSelectedGames(newSelection);
  };

  const selectAllGames = () => {
    setSelectedGames(new Set(scrapedGames.map(g => g.espnId)));
  };

  const deselectAllGames = () => {
    setSelectedGames(new Set());
  };

  const saveSelectedGames = async () => {
    if (selectedGames.size === 0) {
      setMessage('No games selected');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const gamesToSave = scrapedGames.filter(game => selectedGames.has(game.espnId));
      const marketsToInsert = [];
      const outcomesToInsert = [];
      const poolsToInsert = [];

      for (const game of gamesToSave) {
        // Find matching teams in database
        const homeTeam = teams.find(t => 
          t.name.toLowerCase().includes(game.homeTeam.name.toLowerCase()) ||
          game.homeTeam.name.toLowerCase().includes(t.name.toLowerCase())
        );
        const awayTeam = teams.find(t => 
          t.name.toLowerCase().includes(game.awayTeam.name.toLowerCase()) ||
          game.awayTeam.name.toLowerCase().includes(t.name.toLowerCase())
        );

        if (!homeTeam || !awayTeam) {
          console.warn(`Could not match teams for game: ${game.homeTeam.name} vs ${game.awayTeam.name}`);
          continue;
        }

        const matchDate = new Date(game.date);
        const liquidityPerOutcome = initialLiquidity / 3;
        const kConstant = liquidityPerOutcome * liquidityPerOutcome;

        // Create market
        const marketId = crypto.randomUUID();
        marketsToInsert.push({
          id: marketId,
          sport_id: selectedSport,
          league_id: selectedLeague,
          team_a_id: homeTeam.id,
          team_b_id: awayTeam.id,
          match_date: matchDate.toISOString(),
          venue_type: game.isNeutralSite ? 'neutral' : 'home_away',
          home_team_id: game.isNeutralSite ? null : homeTeam.id,
          market_type: 'multi_choice',
          total_liquidity: initialLiquidity,
          k_constant: kConstant,
          liquidity_fee: liquidityFee,
          created_by: user?.id,
          trading_enabled: true,
          is_featured: false,
          status: 'open',
          espn_id: game.espnId  // Store ESPN ID for future updates
        });

        // Create outcomes
        const initialPrice = 1.0 / 3;
        const outcomes = [
          {
            market_id: marketId,
            outcome_type: 'home_win',
            outcome_name: `${homeTeam.name} Win`,
            outcome_symbol: 'HOME_WIN',
            total_shares: liquidityPerOutcome,
            reserve: liquidityPerOutcome,
            current_price: Number(initialPrice.toFixed(6)),
            volume_24h: 0,
            display_order: 0,
            color_hex: '#DA291C'
          },
          {
            market_id: marketId,
            outcome_type: 'draw',
            outcome_name: 'Draw',
            outcome_symbol: 'DRAW',
            total_shares: liquidityPerOutcome,
            reserve: liquidityPerOutcome,
            current_price: Number(initialPrice.toFixed(6)),
            volume_24h: 0,
            display_order: 1,
            color_hex: '#95BF47'
          },
          {
            market_id: marketId,
            outcome_type: 'away_win',
            outcome_name: `${awayTeam.name} Win`,
            outcome_symbol: 'AWAY_WIN',
            total_shares: liquidityPerOutcome,
            reserve: liquidityPerOutcome,
            current_price: Number(initialPrice.toFixed(6)),
            volume_24h: 0,
            display_order: 2,
            color_hex: '#EF0107'
          }
        ];

        outcomesToInsert.push(...outcomes);

        // Create liquidity pool
        poolsToInsert.push({
          market_id: marketId,
          total_liquidity: initialLiquidity,
          utilized_liquidity: 0,
          available_liquidity: initialLiquidity,
          k_constant: kConstant,
          fee_rate: liquidityFee,
          total_fees_collected: 0,
          daily_volume: 0
        });
      }

      if (marketsToInsert.length === 0) {
        throw new Error('Could not match any teams. Please ensure teams exist in your database.');
      }

      // Insert markets
      const { error: marketsError } = await supabase
        .from('markets')
        .insert(marketsToInsert);

      if (marketsError) throw marketsError;

      // Insert outcomes
      const { error: outcomesError } = await supabase
        .from('market_outcomes')
        .insert(outcomesToInsert);

      if (outcomesError) throw outcomesError;

      // Insert liquidity pools
      const { error: poolsError } = await supabase
        .from('liquidity_pools')
        .insert(poolsToInsert);

      if (poolsError) throw poolsError;

      setMessage(`Successfully saved ${marketsToInsert.length} games!`);
      setScrapedGames([]);
      setSelectedGames(new Set());
    } catch (error) {
      console.error('Error saving games:', error);
      setMessage(error instanceof Error ? error.message : 'Error saving games');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Game Scraper</h1>

        {/* Selection Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Sport Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Sport
              </label>
              <select
                value={selectedSport}
                onChange={(e) => {
                  setSelectedSport(e.target.value);
                  setSelectedLeague('');
                  setScrapedGames([]);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- Choose Sport --</option>
                {sports.map(sport => (
                  <option key={sport.id} value={sport.id}>
                    {sport.name}
                  </option>
                ))}
              </select>
            </div>

            {/* League Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select League
              </label>
              <select
                value={selectedLeague}
                onChange={(e) => {
                  setSelectedLeague(e.target.value);
                  setScrapedGames([]);
                }}
                disabled={!selectedSport}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              >
                <option value="">-- Choose League --</option>
                {leagues.map(league => (
                  <option key={league.id} value={league.id}>
                    {league.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* AMM Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Initial Liquidity per Market ($)
              </label>
              <input
                type="number"
                value={initialLiquidity}
                onChange={(e) => setInitialLiquidity(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="3000"
                max="300000"
                step="1000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trading Fee (%)
              </label>
              <input
                type="number"
                value={liquidityFee * 100}
                onChange={(e) => setLiquidityFee(Number(e.target.value) / 100)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="1"
                max="10"
                step="0.1"
              />
            </div>
          </div>

          {/* Scrape Button */}
          <button
            onClick={scrapeGames}
            disabled={!selectedSport || !selectedLeague || loading}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Scraping Games...' : 'Scrape Upcoming Games'}
          </button>

          {/* Message */}
          {message && (
            <div className={`mt-4 p-4 rounded-lg ${
              message.includes('Error') || message.includes('error')
                ? 'bg-red-50 text-red-700'
                : 'bg-green-50 text-green-700'
            }`}>
              {message}
            </div>
          )}
        </div>

        {/* Scraped Games Display */}
        {scrapedGames.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Upcoming Games ({scrapedGames.length})
              </h2>
              <div className="flex space-x-2">
                <button
                  onClick={selectAllGames}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAllGames}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Deselect All
                </button>
                <button
                  onClick={saveSelectedGames}
                  disabled={saving || selectedGames.size === 0}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <FiSave />
                      <span>Save Selected ({selectedGames.size})</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {scrapedGames.map((game) => (
                <div
                  key={game.espnId}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedGames.has(game.espnId)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => toggleGameSelection(game.espnId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <input
                          type="checkbox"
                          checked={selectedGames.has(game.espnId)}
                          onChange={() => toggleGameSelection(game.espnId)}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-lg font-semibold text-gray-900">
                              {game.homeTeam.name} vs {game.awayTeam.name}
                            </div>
                            <div className="flex items-center space-x-2 text-sm text-gray-500">
                              <FiCalendar />
                              <span>{new Date(game.date).toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <div className="flex items-center space-x-1">
                              <FiMapPin />
                              <span>{game.venue}</span>
                            </div>
                            {game.isNeutralSite && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                                Neutral Site
                              </span>
                            )}
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                              {game.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {selectedGames.has(game.espnId) && (
                      <FiCheckCircle className="text-blue-600 ml-4" size={24} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
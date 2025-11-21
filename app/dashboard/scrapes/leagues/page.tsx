'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { FiGlobe, FiCheckCircle, FiSave, FiX } from 'react-icons/fi';

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

interface ESPNLeague {
  id: string;
  name: string;
  abbreviation: string;
  slug: string;
  logos?: Array<{ href: string }>;
  season?: {
    year: number;
    displayName: string;
  };
}

interface ScrapedLeague {
  espnId: string;
  name: string;
  abbreviation: string;
  slug: string;
  season: string;
  logo_url: string;
  country_code: string;
}

// Mapping of ESPN league slugs to country codes
const LEAGUE_COUNTRY_MAP: { [key: string]: string } = {
  // Soccer
  'eng.1': 'GB',
  'esp.1': 'ES',
  'ita.1': 'IT',
  'ger.1': 'DE',
  'fra.1': 'FR',
  'por.1': 'PT',
  'ned.1': 'NL',
  'eng.2': 'GB',
  'usa.1': 'US',
  'mex.1': 'MX',
  'bra.1': 'BR',
  'arg.1': 'AR',
  'sau.1': 'SA',
  'egy.1': 'EG',
  'rsa.1': 'ZA',
  'uefa.champions': 'EU',
  'uefa.europa': 'EU',
  'uefa.europa.conf': 'EU',
  'conmebol.libertadores': 'SA',
  'conmebol.sudamericana': 'SA',
  'conmebol.america': 'SA',
  'concacaf.champions': 'NA',
  'concacaf.gold': 'NA',
  'caf.nations': 'AF',
  'caf.champions': 'AF',
  'caf.confed': 'AF',
  'afc.champions': 'AS',
  'afc.asian': 'AS',
  'fifa.world': 'INT',
  'fifa.wyc': 'INT',
  'fifa.u17': 'INT',
  'fifa.cwc': 'INT',
  'uefa.euro': 'EU',
  
  // Basketball
  'nba': 'US',
  'wnba': 'US',
  'mens-college-basketball': 'US',
  'womens-college-basketball': 'US',
  'euroleague': 'EU',
  
  // American Football
  'nfl': 'US',
  'college-football': 'US',
  
  // Baseball
  'mlb': 'US',
  
  // Hockey
  'nhl': 'US',
  
  // Cricket
  'ipl': 'IN',
  'bbl': 'AU',
  't20': 'ZA',
  'world-cup': 'INT',
  
  // Rugby
  'six-nations': 'EU',
  'rugby-championship': 'INT',
  'super-rugby': 'AU',
  'urc': 'EU',
  
  // Tennis
  'atp': 'INT',
  'wta': 'INT',
  'australian-open': 'AU',
  'french-open': 'FR',
  'wimbledon': 'GB',
  'us-open': 'US',
};

// Predefined ESPN leagues by sport (based on what's actually available on ESPN)
const ESPN_LEAGUES: { [sport: string]: Array<{
  name: string;
  espn_code: string;
  country_code: string;
  season: string;
}> } = {
  soccer: [
    // Top 5 European Leagues
    { name: 'English Premier League', espn_code: 'eng.1', country_code: 'GB', season: '2024/2025' },
    { name: 'La Liga', espn_code: 'esp.1', country_code: 'ES', season: '2024/2025' },
    { name: 'Serie A', espn_code: 'ita.1', country_code: 'IT', season: '2024/2025' },
    { name: 'Bundesliga', espn_code: 'ger.1', country_code: 'DE', season: '2024/2025' },
    { name: 'Ligue 1', espn_code: 'fra.1', country_code: 'FR', season: '2024/2025' },
    
    // Other European Leagues
    { name: 'Primeira Liga', espn_code: 'por.1', country_code: 'PT', season: '2024/2025' },
    { name: 'Eredivisie', espn_code: 'ned.1', country_code: 'NL', season: '2024/2025' },
    { name: 'EFL Championship', espn_code: 'eng.2', country_code: 'GB', season: '2024/2025' },
    { name: 'Scottish Premiership', espn_code: 'sco.1', country_code: 'GB', season: '2024/2025' },
    { name: 'Belgian Pro League', espn_code: 'bel.1', country_code: 'BE', season: '2024/2025' },
    { name: 'Turkish Super Lig', espn_code: 'tur.1', country_code: 'TR', season: '2024/2025' },
    
    // UEFA Competitions
    { name: 'UEFA Champions League', espn_code: 'uefa.champions', country_code: 'EU', season: '2024/2025' },
    { name: 'UEFA Europa League', espn_code: 'uefa.europa', country_code: 'EU', season: '2024/2025' },
    { name: 'UEFA Conference League', espn_code: 'uefa.europa.conf', country_code: 'EU', season: '2024/2025' },
    
    // Americas
    { name: 'MLS (Major League Soccer)', espn_code: 'usa.1', country_code: 'US', season: '2024' },
    { name: 'Liga MX', espn_code: 'mex.1', country_code: 'MX', season: '2024/2025' },
    { name: 'Brazil Serie A', espn_code: 'bra.1', country_code: 'BR', season: '2024' },
    { name: 'Argentina Primera División', espn_code: 'arg.1', country_code: 'AR', season: '2024' },
    { name: 'CONMEBOL Copa Libertadores', espn_code: 'conmebol.libertadores', country_code: 'SA', season: '2024' },
    { name: 'CONMEBOL Copa Sudamericana', espn_code: 'conmebol.sudamericana', country_code: 'SA', season: '2024' },
    { name: 'CONCACAF Champions Cup', espn_code: 'concacaf.champions', country_code: 'NA', season: '2024/2025' },
    
    // International Tournaments
    { name: 'FIFA World Cup', espn_code: 'fifa.world', country_code: 'INT', season: '2026' },
    { name: 'UEFA Euro Championship', espn_code: 'uefa.euro', country_code: 'EU', season: '2024' },
    { name: 'CONMEBOL Copa América', espn_code: 'conmebol.america', country_code: 'SA', season: '2024' },
    { name: 'CONCACAF Gold Cup', espn_code: 'concacaf.gold', country_code: 'NA', season: '2023' },
    { name: 'CAF Africa Cup of Nations (AFCON)', espn_code: 'caf.nations', country_code: 'AF', season: '2025' },
    { name: 'AFC Asian Cup', espn_code: 'afc.asian', country_code: 'AS', season: '2024' },
    
    // Africa & Middle East
    { name: 'Saudi Pro League', espn_code: 'sau.1', country_code: 'SA', season: '2024/2025' },
    { name: 'Egyptian Premier League', espn_code: 'egy.1', country_code: 'EG', season: '2024/2025' },
    { name: 'South African Premier Division (PSL / DStv Premiership)', espn_code: 'rsa.1', country_code: 'ZA', season: '2024/2025' },
    { name: 'CAF Champions League', espn_code: 'caf.champions', country_code: 'AF', season: '2024/2025' },
    { name: 'CAF Confederation Cup', espn_code: 'caf.confed', country_code: 'AF', season: '2024/2025' },
    
    // Asia & Oceania
    { name: 'AFC Champions League', espn_code: 'afc.champions', country_code: 'AS', season: '2024/2025' },
    { name: 'A-League', espn_code: 'aus.1', country_code: 'AU', season: '2024/2025' },
  ],
  
  basketball: [
    { name: 'NBA', espn_code: 'nba', country_code: 'US', season: '2024/2025' },
    { name: 'WNBA', espn_code: 'wnba', country_code: 'US', season: '2024' },
    { name: 'NCAA Men\'s Basketball', espn_code: 'mens-college-basketball', country_code: 'US', season: '2024/2025' },
    { name: 'NCAA Women\'s Basketball', espn_code: 'womens-college-basketball', country_code: 'US', season: '2024/2025' },
    { name: 'EuroLeague', espn_code: 'euroleague', country_code: 'EU', season: '2024/2025' },
  ],
  
  football: [
    { name: 'NFL', espn_code: 'nfl', country_code: 'US', season: '2024' },
    { name: 'NCAA Football', espn_code: 'college-football', country_code: 'US', season: '2024' },
  ],
  
  baseball: [
    { name: 'MLB', espn_code: 'mlb', country_code: 'US', season: '2024' },
    { name: 'NCAA Baseball', espn_code: 'college-baseball', country_code: 'US', season: '2024' },
  ],
  
  hockey: [
    { name: 'NHL', espn_code: 'nhl', country_code: 'US', season: '2024/2025' },
  ],
  
  cricket: [
    { name: 'Indian Premier League (IPL)', espn_code: 'ipl', country_code: 'IN', season: '2024' },
    { name: 'Big Bash League (BBL)', espn_code: 'bbl', country_code: 'AU', season: '2024' },
    { name: 'ICC Cricket World Cup', espn_code: 'world-cup', country_code: 'INT', season: '2023' },
    { name: 'CSA T20 Challenge', espn_code: 't20', country_code: 'ZA', season: '2024' },
  ],
  
  rugby: [
    { name: 'Six Nations Championship', espn_code: 'six-nations', country_code: 'EU', season: '2024' },
    { name: 'The Rugby Championship', espn_code: 'rugby-championship', country_code: 'INT', season: '2024' },
    { name: 'Super Rugby Pacific', espn_code: 'super-rugby', country_code: 'AU', season: '2024' },
    { name: 'United Rugby Championship', espn_code: 'urc', country_code: 'EU', season: '2024/2025' },
  ],
  
  tennis: [
    { name: 'ATP Tour', espn_code: 'atp', country_code: 'INT', season: '2024' },
    { name: 'WTA Tour', espn_code: 'wta', country_code: 'INT', season: '2024' },
    { name: 'Grand Slam: Australian Open', espn_code: 'australian-open', country_code: 'AU', season: '2024' },
    { name: 'Grand Slam: Roland Garros', espn_code: 'french-open', country_code: 'FR', season: '2024' },
    { name: 'Grand Slam: Wimbledon', espn_code: 'wimbledon', country_code: 'GB', season: '2024' },
    { name: 'Grand Slam: US Open', espn_code: 'us-open', country_code: 'US', season: '2024' },
  ],
};

export default function LeagueScraper() {
  const [sports, setSports] = useState<Sport[]>([]);
  const [selectedSport, setSelectedSport] = useState<string>('');
  const [availableLeagues, setAvailableLeagues] = useState<ScrapedLeague[]>([]);
  const [selectedLeagues, setSelectedLeagues] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSports();
  }, []);

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

  const getESPNSportCode = (sportCode: string): string => {
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
    return sportCodeMap[sportCode.toUpperCase()] || sportCode.toLowerCase();
  };

  const getCountryCode = (slug: string, leagueName: string): string => {
    // First try exact match
    if (LEAGUE_COUNTRY_MAP[slug]) {
      return LEAGUE_COUNTRY_MAP[slug];
    }
    
    // Try to infer from league name
    const countryPatterns: { [key: string]: string } = {
      'English': 'GB',
      'Premier League': 'GB',
      'La Liga': 'ES',
      'Spanish': 'ES',
      'Serie A': 'IT',
      'Italian': 'IT',
      'Bundesliga': 'DE',
      'German': 'DE',
      'Ligue 1': 'FR',
      'French': 'FR',
      'MLS': 'US',
      'American': 'US',
      'Liga MX': 'MX',
      'Mexican': 'MX',
      'Brazilian': 'BR',
      'Argentina': 'AR',
      'Saudi': 'SA',
      'Egyptian': 'EG',
      'South African': 'ZA',
      'UEFA': 'EU',
      'Champions League': 'EU',
      'Europa': 'EU',
      'CONMEBOL': 'SA',
      'Copa América': 'SA',
      'Libertadores': 'SA',
      'CONCACAF': 'NA',
      'Gold Cup': 'NA',
      'CAF': 'AF',
      'African': 'AF',
      'AFC': 'AS',
      'Asian': 'AS',
      'FIFA': 'INT',
      'World Cup': 'INT',
      'International': 'INT',
    };
    
    for (const [pattern, code] of Object.entries(countryPatterns)) {
      if (leagueName.includes(pattern)) {
        return code;
      }
    }
    
    return 'INT'; // Default to international
  };

  const loadLeagues = async () => {
    if (!selectedSport) {
      setMessage('Please select a sport');
      return;
    }

    setLoading(true);
    setMessage('');
    setAvailableLeagues([]);
    setSelectedLeagues(new Set());

    try {
      const sport = sports.find(s => s.id === selectedSport);
      if (!sport) {
        throw new Error('Invalid sport selection');
      }

      const espnSportCode = getESPNSportCode(sport.code);
      
      // Get leagues for this sport from our predefined list
      const leagues = ESPN_LEAGUES[espnSportCode] || [];
      
      if (leagues.length === 0) {
        throw new Error(`No ESPN leagues available for ${sport.name}`);
      }

      // Verify each league exists on ESPN by checking scoreboard
      const verifiedLeagues: ScrapedLeague[] = [];
      
      for (const league of leagues) {
        try {
          const url = `https://site.api.espn.com/apis/site/v2/sports/${espnSportCode}/${league.espn_code}/scoreboard`;
          const response = await fetch(url);
          
          if (response.ok) {
            const data = await response.json();
            
            verifiedLeagues.push({
              espnId: league.espn_code,
              name: league.name,
              abbreviation: data.leagues?.[0]?.abbreviation || league.espn_code.toUpperCase(),
              slug: league.espn_code,
              season: league.season,
              logo_url: data.leagues?.[0]?.logos?.[0]?.href || '',
              country_code: league.country_code
            });
          }
        } catch (err) {
          console.log(`League ${league.name} not accessible:`, err);
          // Still add it even if we can't verify
          verifiedLeagues.push({
            espnId: league.espn_code,
            name: league.name,
            abbreviation: league.espn_code.toUpperCase(),
            slug: league.espn_code,
            season: league.season,
            logo_url: '',
            country_code: league.country_code
          });
        }
      }

      setAvailableLeagues(verifiedLeagues);
      setMessage(`Found ${verifiedLeagues.length} ESPN leagues for ${sport.name}`);
    } catch (error) {
      console.error('Error loading leagues:', error);
      setMessage(error instanceof Error ? error.message : 'Error loading leagues');
    } finally {
      setLoading(false);
    }
  };

  const toggleLeagueSelection = (espnId: string) => {
    const newSelection = new Set(selectedLeagues);
    if (newSelection.has(espnId)) {
      newSelection.delete(espnId);
    } else {
      newSelection.add(espnId);
    }
    setSelectedLeagues(newSelection);
  };

  const selectAllLeagues = () => {
    setSelectedLeagues(new Set(availableLeagues.map(l => l.espnId)));
  };

  const deselectAllLeagues = () => {
    setSelectedLeagues(new Set());
  };

  const saveSelectedLeagues = async () => {
    if (selectedLeagues.size === 0) {
      setMessage('No leagues selected');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const leaguesToSave = availableLeagues.filter(league => selectedLeagues.has(league.espnId));

      // Check for existing leagues
      const { data: existingLeagues, error: fetchError } = await supabase
        .from('leagues')
        .select('name')
        .in('name', leaguesToSave.map(l => l.name));

      if (fetchError) throw fetchError;

      const existingNames = new Set(existingLeagues?.map(l => l.name) || []);
      const newLeagues = leaguesToSave.filter(league => !existingNames.has(league.name));

      if (newLeagues.length === 0) {
        setMessage('All selected leagues already exist in the database!');
        setSaving(false);
        return;
      }

      // Prepare leagues for insertion
      const leaguestoInsert = newLeagues.map(league => ({
        sport_id: selectedSport,
        name: league.name,
        country_code: league.country_code,
        season: league.season,
        logo_url: league.logo_url || null,
        is_active: true
      }));

      // Insert leagues
      const { data, error } = await supabase
        .from('leagues')
        .insert(leaguestoInsert)
        .select();

      if (error) throw error;

      const skippedCount = leaguesToSave.length - newLeagues.length;
      let successMessage = `Successfully saved ${data?.length || 0} leagues!`;
      if (skippedCount > 0) {
        successMessage += ` (${skippedCount} leagues already existed and were skipped)`;
      }

      setMessage(successMessage);
      setAvailableLeagues([]);
      setSelectedLeagues(new Set());
    } catch (error) {
      console.error('Error saving leagues:', error);
      setMessage(error instanceof Error ? error.message : 'Error saving leagues');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">League Scraper</h1>

        {/* Selection Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="mb-6">
            {/* Sport Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FiGlobe className="inline mr-1" />
                Select Sport
              </label>
              <select
                value={selectedSport}
                onChange={(e) => {
                  setSelectedSport(e.target.value);
                  setAvailableLeagues([]);
                  setSelectedLeagues(new Set());
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
          </div>

          {/* Load Button */}
          <button
            onClick={loadLeagues}
            disabled={!selectedSport || loading}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Loading Leagues...' : 'Load Available ESPN Leagues'}
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

        {/* Available Leagues Display */}
        {availableLeagues.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Available ESPN Leagues ({availableLeagues.length})
              </h2>
              <div className="flex space-x-2">
                <button
                  onClick={selectAllLeagues}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAllLeagues}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Deselect All
                </button>
                <button
                  onClick={saveSelectedLeagues}
                  disabled={saving || selectedLeagues.size === 0}
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
                      <span>Save Selected ({selectedLeagues.size})</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableLeagues.map((league) => (
                <div
                  key={league.espnId}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedLeagues.has(league.espnId)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => toggleLeagueSelection(league.espnId)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <input
                          type="checkbox"
                          checked={selectedLeagues.has(league.espnId)}
                          onChange={() => toggleLeagueSelection(league.espnId)}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                        {league.logo_url && (
                          <img
                            src={league.logo_url}
                            alt={league.name}
                            className="w-10 h-10 object-contain"
                          />
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-1">{league.name}</h3>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p><span className="font-medium">Code:</span> {league.slug}</p>
                        <p><span className="font-medium">Country:</span> {league.country_code}</p>
                        <p><span className="font-medium">Season:</span> {league.season}</p>
                      </div>
                    </div>
                    {selectedLeagues.has(league.espnId) && (
                      <FiCheckCircle className="text-blue-600 ml-2 flex-shrink-0" size={24} />
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
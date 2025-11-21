'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

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

interface ESPNTeam {
  id: string;
  displayName: string;
  shortDisplayName: string;
  abbreviation: string;
  logos?: Array<{ href: string }>;
  color?: string;
  alternateColor?: string;
}

interface ScrapedTeam {
  espnId: string;
  name: string;
  short_name: string;
  logo_url: string;
  colors: {
    primary?: string;
    alternate?: string;
  };
}

export default function TeamScraper() {
  const [sports, setSports] = useState<Sport[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedSport, setSelectedSport] = useState<string>('');
  const [selectedLeague, setSelectedLeague] = useState<string>('');
  const [scrapedTeams, setScrapedTeams] = useState<ScrapedTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Fetch sports on mount
  useEffect(() => {
    fetchSports();
  }, []);

  // Fetch leagues when sport is selected
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

  const getESPNLeagueCode = (sportCode: string, leagueName: string): string => {
    // First, convert your sport codes to ESPN sport codes
    const sportCodeMap: { [key: string]: string } = {
      'SOC': 'soccer',
      'BAS': 'basketball', 
      'AMF': 'football', // American Football
      'CRI': 'cricket',
      'RUG': 'rugby',
      'TEN': 'tennis',
      'BASE': 'baseball',
      'HOC': 'hockey',
      'ESG': 'esports',
      'ATH': 'athletics'
    };
    
    // Convert to lowercase and map to ESPN sport code
    const espnSportCode = sportCodeMap[sportCode.toUpperCase()] || sportCode.toLowerCase();
    
    console.log('Sport Code Conversion:', sportCode, '→', espnSportCode);
    
    // Map your league names to ESPN league codes
    const mappings: { [key: string]: { [key: string]: string } } = {
      football: {
        'NFL': 'nfl',
        'NCAA Football': 'college-football'
      },
      basketball: {
        'NBA': 'nba',
        'WNBA': 'wnba',
        'NCAA Men': 'mens-college-basketball',
        'NCAA Women': 'womens-college-basketball',
        'EuroLeague': 'euroleague',
        // 'Basketball Africa League (BAL)': Not available on ESPN
      },
      soccer: {
        // TOP 5 EUROPEAN LEAGUES
        'English Premier League': 'eng.1',
        'La Liga': 'esp.1',
        'Serie A': 'ita.1',
        'Bundesliga': 'ger.1',
        'Ligue 1': 'fra.1',
        
        // OTHER EUROPEAN LEAGUES
        'Primeira Liga': 'por.1',
        'Eredivisie': 'ned.1',
        'EFL Championship': 'eng.2',
        
        // UEFA COMPETITIONS
        'UEFA Champions League': 'uefa.champions',
        'UEFA Europa League': 'uefa.europa',
        'UEFA Conference League': 'uefa.europa.conf',
        
        // AMERICAS - CLUB
        'MLS (Major League Soccer)': 'usa.1',
        'Liga MX': 'mex.1',
        'Brazil Serie A': 'bra.1',
        'Argentina Primera División': 'arg.1',
        'CONMEBOL Copa Libertadores': 'conmebol.libertadores',
        'CONMEBOL Copa Sudamericana': 'conmebol.sudamericana',
        'CONCACAF Champions Cup': 'concacaf.champions',
        
        // AMERICAS - INTERNATIONAL
        'FIFA World Cup': 'fifa.world',
        'CONMEBOL Copa América': 'conmebol.america',
        'CONCACAF Gold Cup': 'concacaf.gold',
        
        // EUROPE - INTERNATIONAL
        'UEFA Euro Championship': 'uefa.euro',
        
        // AFRICA - INTERNATIONAL
        'CAF Africa Cup of Nations (AFCON)': 'caf.nations',
        'CAF Champions League': 'caf.champions',
        'CAF Confederation Cup': 'caf.confed',
        
        // ASIA
        'AFC Champions League': 'afc.champions',
        'AFC Asian Cup': 'afc.asian',
        
        // MIDDLE EAST
        'Saudi Pro League': 'sau.1',
        
        // AFRICA - CLUB LEAGUES (Most not on ESPN)
        'Egyptian Premier League': 'egy.1',
        'South African Premier Division (PSL / DStv Premiership)': 'rsa.1',
        
        // FIFA YOUTH TOURNAMENTS
        'FIFA U-20 World Cup': 'fifa.wyc',
        'FIFA U-17 World Cup': 'fifa.u17',
        'FIFA Club World Cup': 'fifa.cwc',
        
        // NOT AVAILABLE ON ESPN:
        // - Botola Pro (Morocco)
        // - Senegal Ligue 1
        // - CAF African Nations Championship (CHAN)
        // - Algerian Ligue 1
        // - National First Division (Motsepe)
        // - Nigeria Professional Football League
        // - Ivory Coast Ligue 1
        // - CAF Women's Africa Cup of Nations
        // - Kenyan Premier League
        // - Zambian Super League
        // - Tunisian Ligue Professionnelle 1
        // - Angolan Girabola
        // - DR Congo Linafoot
        // - Ethiopian Premier League
        // - Cameroon Elite One
        // - Ghana Premier League
        // - Uganda Premier League
        // - OFC Champions League
      },
      baseball: {
        'MLB': 'mlb'
      },
      hockey: {
        'NHL': 'nhl'
      },
      cricket: {
        'Indian Premier League (IPL)': 'ipl',
        'Big Bash League (BBL)': 'bbl',
        'CSA T20 Challenge': 't20',
        'ICC Cricket World Cup': 'world-cup',
        // Note: ESPN cricket coverage is limited
      },
      rugby: {
        'Six Nations Championship': 'six-nations',
        'The Rugby Championship': 'rugby-championship',
        'Super Rugby Pacific': 'super-rugby',
        'United Rugby Championship': 'urc'
      },
      tennis: {
        'ATP Tour': 'atp',
        'WTA Tour': 'wta',
        'Grand Slam: Australian Open': 'australian-open',
        'Grand Slam: Roland Garros': 'french-open',
        'Grand Slam: Wimbledon': 'wimbledon',
        'Grand Slam: US Open': 'us-open'
      },
      athletics: {
        'Olympic Games Athletics': 'olympics',
        'World Athletics Diamond League': 'diamond-league'
        // Note: ESPN athletics coverage is very limited
      }
      // ESPORTS NOT AVAILABLE ON ESPN:
      // - CS2 Major Championship
      // - League of Legends Worlds
      // - Dota 2 The International
    };

    return mappings[espnSportCode]?.[leagueName] || '';
  };

  const scrapeTeams = async () => {
    if (!selectedSport || !selectedLeague) {
      setMessage('Please select both sport and league');
      return;
    }

    setLoading(true);
    setMessage('');
    setScrapedTeams([]);

    try {
      // Get sport and league details
      const sport = sports.find(s => s.id === selectedSport);
      const league = leagues.find(l => l.id === selectedLeague);

      if (!sport || !league) {
        throw new Error('Invalid sport or league selection');
      }

      console.log('=== LINK GENERATION DEBUG ===');
      console.log('=== LINK GENERATION DEBUG ===');
      console.log('Selected Sport:', sport);
      console.log('Selected League:', league);
      console.log('Sport Code:', sport.code);
      console.log('League Name:', league.name);

      // Convert sport code to ESPN format FIRST
      const sportCodeMap: { [key: string]: string } = {
        'SOC': 'soccer',
        'BAS': 'basketball', 
        'AMF': 'football',
        'CRI': 'cricket',
        'RUG': 'rugby',
        'TEN': 'tennis',
        'BASE': 'baseball',
        'HOC': 'hockey',
        'ESG': 'esports'
      };
      
      const espnSportCode = sportCodeMap[sport.code.toUpperCase()] || sport.code.toLowerCase();
      console.log('ESPN Sport Code:', espnSportCode);

      const espnLeagueCode = getESPNLeagueCode(sport.code, league.name);
      console.log('ESPN League Code:', espnLeagueCode);
      
      if (!espnLeagueCode) {
        throw new Error(`No ESPN mapping found for ${sport.name} - ${league.name}`);
      }

      // Fetch teams from ESPN API (direct fetch - no CORS issues)
      const url = `https://site.api.espn.com/apis/site/v2/sports/${espnSportCode}/${espnLeagueCode}/teams`;
      console.log('=== FINAL URL ===');
      console.log(url);
      console.log('================');
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Full ESPN API Response:', data);

      // ESPN API structure: data.sports[0].leagues[0].teams[].team
      let espnTeams: ESPNTeam[] = [];
      
      if (data.sports?.[0]?.leagues?.[0]?.teams) {
        espnTeams = data.sports[0].leagues[0].teams.map((t: any) => t.team);
        console.log('Extracted teams:', espnTeams);
      } else {
        console.error('Unexpected API structure:', data);
        throw new Error('No teams found in API response. Check console for structure.');
      }

      if (espnTeams.length === 0) {
        throw new Error('No teams found for this league');
      }

      // Transform ESPN data to our format
      const teams: ScrapedTeam[] = espnTeams.map(team => ({
        espnId: team.id,
        name: team.displayName,
        short_name: team.shortDisplayName || team.abbreviation,
        logo_url: team.logos?.[0]?.href || '',
        colors: {
          primary: team.color ? `#${team.color}` : undefined,
          alternate: team.alternateColor ? `#${team.alternateColor}` : undefined
        }
      }));

      setScrapedTeams(teams);
      setMessage(`Found ${teams.length} teams`);
    } catch (error) {
      console.error('Error scraping teams:', error);
      setMessage(error instanceof Error ? error.message : 'Error scraping teams');
    } finally {
      setLoading(false);
    }
  };

  const saveAllTeams = async () => {
    if (scrapedTeams.length === 0) {
      setMessage('No teams to save');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      // First, get existing team names to avoid duplicates
      const { data: existingTeams, error: fetchError } = await supabase
        .from('teams')
        .select('name')
        .in('name', scrapedTeams.map(t => t.name));

      if (fetchError) throw fetchError;

      const existingNames = new Set(existingTeams?.map(t => t.name) || []);
      
      // Filter out teams that already exist
      const newTeams = scrapedTeams.filter(team => !existingNames.has(team.name));
      
      if (newTeams.length === 0) {
        setMessage('All teams already exist in the database!');
        setSaving(false);
        return;
      }

      // Prepare teams for insertion
      const teamsToInsert = newTeams.map(team => ({
        name: team.name,
        short_name: team.short_name,
        logo_url: team.logo_url,
        colors: team.colors,
        is_active: true
      }));

      // Insert teams
      const { data, error } = await supabase
        .from('teams')
        .insert(teamsToInsert)
        .select();

      if (error) {
        throw error;
      }

      const skippedCount = scrapedTeams.length - newTeams.length;
      let message = `Successfully saved ${data?.length || 0} teams!`;
      if (skippedCount > 0) {
        message += ` (${skippedCount} teams already existed and were skipped)`;
      }
      
      setMessage(message);
      setScrapedTeams([]);
    } catch (error) {
      console.error('Error saving teams:', error);
      setMessage(error instanceof Error ? error.message : 'Error saving teams');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Team Scraper</h1>

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
                  setScrapedTeams([]);
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
                  setScrapedTeams([]);
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

          {/* Scrape Button */}
          <button
            onClick={scrapeTeams}
            disabled={!selectedSport || !selectedLeague || loading}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Scraping Teams...' : 'Scrape Teams'}
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

        {/* Scraped Teams Display */}
        {scrapedTeams.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Scraped Teams ({scrapedTeams.length})
              </h2>
              <button
                onClick={saveAllTeams}
                disabled={saving}
                className="bg-green-600 text-white py-2 px-6 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : 'Save All Teams'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scrapedTeams.map((team, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center space-x-4">
                    {team.logo_url && (
                      <img
                        src={team.logo_url}
                        alt={team.name}
                        className="w-12 h-12 object-contain"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{team.name}</h3>
                      <p className="text-sm text-gray-600">{team.short_name}</p>
                    </div>
                  </div>
                  {(team.colors.primary || team.colors.alternate) && (
                    <div className="flex space-x-2 mt-3">
                      {team.colors.primary && (
                        <div
                          className="w-8 h-8 rounded border border-gray-300"
                          style={{ backgroundColor: team.colors.primary }}
                          title={team.colors.primary}
                        />
                      )}
                      {team.colors.alternate && (
                        <div
                          className="w-8 h-8 rounded border border-gray-300"
                          style={{ backgroundColor: team.colors.alternate }}
                          title={team.colors.alternate}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
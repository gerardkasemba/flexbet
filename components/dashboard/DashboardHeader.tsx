'use client'

import { useAuth } from '@/lib/auth-context'
import { FiBell, FiUser, FiLogOut, FiMenu, FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface DashboardHeaderProps {
  onMobileMenuToggle?: () => void
  isMobileMenuOpen?: boolean
}

interface Team {
  name: string;
  short_name: string;
  logo_url: string;
}

interface Market {
  id: string;
  espn_id: string;
  team_a_score: number;
  team_b_score: number;
  status: string;
  match_date: string;
  team_a_id: string;
  team_b_id: string;
  team_a: Team; // Change from Team[] to Team
  team_b: Team; // Change from Team[] to Team
}

interface LiveGame {
  id: string;
  espn_id: string;
  team_a_score: number;
  team_b_score: number;
  status: string;
  team_a_name: string;
  team_b_name: string;
  team_a_short_name?: string;
  team_b_short_name?: string;
  team_a_logo?: string;
  team_b_logo?: string;
}

// Simple polling hook without WebSockets
function useGameScore(espnId?: string) {
  const [scoreData, setScoreData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchScore = async () => {
    if (!espnId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/espn/game/${espnId}`);
      if (response.ok) {
        const data = await response.json();
        setScoreData(data);
      }
    } catch (error) {
      console.error('Error fetching game score:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!espnId) return;

    fetchScore();
    
    // Poll every 30 seconds
    const interval = setInterval(fetchScore, 30000);
    
    return () => clearInterval(interval);
  }, [espnId]);

  return { scoreData, isLoading, refetch: fetchScore };
}

function GameBox({ game }: { game: LiveGame }) {
  const { scoreData, isLoading } = useGameScore(game.espn_id);
  
  const currentGame = scoreData ? {
    ...game,
    team_a_score: scoreData.homeScore ?? game.team_a_score,
    team_b_score: scoreData.awayScore ?? game.team_b_score,
    status: mapESPNStatusToMarketStatus(scoreData.status) ?? game.status
  } : game;

  const getTeamDisplayName = (teamName: string, shortName?: string) => {
    return shortName || teamName.substring(0, 3).toUpperCase();
  };

  return (
    <div className="flex-shrink-0 w-20 xs:w-24 sm:w-28 md:w-32 bg-white rounded-lg border border-gray-200 p-2 sm:p-3 shadow-xs hover:shadow-sm transition-all">
      {/* Status indicator - Minimal on mobile */}
      <div className="flex items-center justify-between mb-1 sm:mb-2">
        <span className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] xs:text-xs font-medium ${
          currentGame.status === 'live' ? 'bg-red-100 text-red-800' :
          currentGame.status === 'closed' ? 'bg-orange-100 text-orange-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {currentGame.status === 'live' ? 'LIVE' : 
           currentGame.status === 'closed' ? 'END' : 
           currentGame.status.toUpperCase()}
        </span>
        {isLoading && (
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full animate-pulse"></div>
        )}
      </div>

      {/* Team A - Compact on mobile */}
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className="flex items-center space-x-1 sm:space-x-2 flex-1 min-w-0">
          {game.team_a_logo ? (
            <img 
              src={game.team_a_logo} 
              alt={game.team_a_name}
              className="w-4 h-4 xs:w-5 xs:h-5 sm:w-6 sm:h-6 rounded-full object-cover flex-shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-4 h-4 xs:w-5 xs:h-5 sm:w-6 sm:h-6 bg-gray-200 rounded-full flex items-center justify-center text-[10px] xs:text-xs font-medium text-gray-600 flex-shrink-0">
              {getTeamDisplayName(game.team_a_name, game.team_a_short_name).substring(0, 2)}
            </div>
          )}
          <span className="text-[10px] xs:text-xs sm:text-sm font-medium text-gray-900 truncate">
            {getTeamDisplayName(game.team_a_name, game.team_a_short_name)}
          </span>
        </div>
        <div className="font-mono text-sm xs:text-base sm:text-lg font-bold text-gray-900 ml-1 flex-shrink-0">
          {currentGame.team_a_score}
        </div>
      </div>

      {/* Team B - Compact on mobile */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1 sm:space-x-2 flex-1 min-w-0">
          {game.team_b_logo ? (
            <img 
              src={game.team_b_logo} 
              alt={game.team_b_name}
              className="w-4 h-4 xs:w-5 xs:h-5 sm:w-6 sm:h-6 rounded-full object-cover flex-shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-4 h-4 xs:w-5 xs:h-5 sm:w-6 sm:h-6 bg-gray-200 rounded-full flex items-center justify-center text-[10px] xs:text-xs font-medium text-gray-600 flex-shrink-0">
              {getTeamDisplayName(game.team_b_name, game.team_b_short_name).substring(0, 2)}
            </div>
          )}
          <span className="text-[10px] xs:text-xs sm:text-sm font-medium text-gray-900 truncate">
            {getTeamDisplayName(game.team_b_name, game.team_b_short_name)}
          </span>
        </div>
        <div className="font-mono text-sm xs:text-base sm:text-lg font-bold text-gray-900 ml-1 flex-shrink-0">
          {currentGame.team_b_score}
        </div>
      </div>
    </div>
  );
}

function mapESPNStatusToMarketStatus(espnStatus: string): string {
  const statusMap: { [key: string]: string } = {
    'in': 'live',
    'halftime': 'live',
    'post': 'closed',
    'final': 'closed',
    'closed': 'closed',
    'suspended': 'suspended',
    'completed': 'closed',
    'full-time': 'closed'
  };
  
  return statusMap[espnStatus] || 'open';
}

function ScoreCarousel() {
  const [liveGames, setLiveGames] = useState<LiveGame[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleGames, setVisibleGames] = useState(3); // Number of games visible at once
  const carouselRef = useRef<HTMLDivElement>(null);

  // Calculate visible games based on container width
  useEffect(() => {
    const updateVisibleGames = () => {
      if (carouselRef.current) {
        const containerWidth = carouselRef.current.offsetWidth;
        // Each game box is 192px (w-48) + gap (16px) = 208px per game
        const gamesThatFit = Math.floor(containerWidth / 208);
        setVisibleGames(Math.max(1, gamesThatFit));
      }
    };

    updateVisibleGames();
    window.addEventListener('resize', updateVisibleGames);
    return () => window.removeEventListener('resize', updateVisibleGames);
  }, []);

  // Initial fetch and setup
  useEffect(() => {
    fetchActiveGames();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchActiveGames, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchActiveGames = async () => {
    try {
      // First get the markets
      const { data: markets, error } = await supabase
        .from('markets')
        .select(`
          id,
          espn_id,
          team_a_score,
          team_b_score,
          status,
          match_date,
          team_a_id,
          team_b_id
        `)
        .in('status', ['open', 'live', 'suspended'])
        .gte('match_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .lte('match_date', new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString())
        .not('espn_id', 'is', null)
        .limit(10);

      if (error) {
        console.error('Error fetching active games:', error);
        return;
      }

      if (!markets || markets.length === 0) {
        setLiveGames([]);
        return;
      }

      // Then get team details separately
      const teamIds = new Set<string>();
      markets.forEach(market => {
        if (market.team_a_id) teamIds.add(market.team_a_id);
        if (market.team_b_id) teamIds.add(market.team_b_id);
      });

      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, short_name, logo_url')
        .in('id', Array.from(teamIds));

      if (teamsError) {
        console.error('Error fetching teams:', teamsError);
        return;
      }

      // Create a map for easy team lookup
      const teamsMap = new Map();
      teams?.forEach(team => {
        teamsMap.set(team.id, team);
      });

      const gamesWithTeamDetails: LiveGame[] = markets.map((market) => {
        const teamA = teamsMap.get(market.team_a_id);
        const teamB = teamsMap.get(market.team_b_id);

        return {
          id: market.id,
          espn_id: market.espn_id,
          team_a_score: market.team_a_score,
          team_b_score: market.team_b_score,
          status: market.status,
          team_a_name: teamA?.name || 'Unknown Team A',
          team_b_name: teamB?.name || 'Unknown Team B',
          team_a_short_name: teamA?.short_name || 'TMA',
          team_b_short_name: teamB?.short_name || 'TMB',
          team_a_logo: teamA?.logo_url || undefined,
          team_b_logo: teamB?.logo_url || undefined
        };
      });

      setLiveGames(gamesWithTeamDetails);
      setLastUpdate(new Date());

    } catch (error) {
      console.error('Error in fetchActiveGames:', error);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const nextSlide = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex + visibleGames >= liveGames.length ? 0 : prevIndex + 1
    );
  };

  const prevSlide = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? Math.max(0, liveGames.length - visibleGames) : prevIndex - 1
    );
  };

  if (liveGames.length === 0) {
    return null; // Don't show anything if no games
  }

  const canGoNext = liveGames.length > visibleGames;
  const canGoPrev = liveGames.length > visibleGames;

  return (
  <div className="border-t border-gray-200 bg-gray-50">
    <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3">
      {/* Header - Minimal on mobile */}
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <h4 className="text-xs sm:text-sm font-semibold text-gray-900">Live Scores</h4>
          <div className="flex items-center space-x-1 sm:space-x-2">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full"></div>
            {/* Optional: Show update time on larger screens */}
            <span className="hidden sm:inline text-xs text-gray-500">
              Updated {formatTime(lastUpdate)}
            </span>
          </div>
        </div>

        {/* Navigation controls - Hide on small mobile, show on larger screens */}
        {liveGames.length > visibleGames && (
          <div className="hidden xs:flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={prevSlide}
              disabled={!canGoPrev}
              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous games"
            >
              <FiChevronLeft size={14} className="sm:w-4 sm:h-4" />
            </button>
            <span className="text-xs text-gray-500 min-w-[35px] sm:min-w-[40px] text-center">
              {Math.min(currentIndex + 1, liveGames.length)}-{Math.min(currentIndex + visibleGames, liveGames.length)} of {liveGames.length}
            </span>
            <button
              onClick={nextSlide}
              disabled={!canGoNext}
              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next games"
            >
              <FiChevronRight size={14} className="sm:w-4 sm:h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Carousel */}
      <div ref={carouselRef} className="relative">
        <div className="flex space-x-2 sm:space-x-3 lg:space-x-4 overflow-hidden">
          {liveGames
            .slice(currentIndex, currentIndex + visibleGames)
            .map((game) => (
              <GameBox key={game.id} game={game} />
            ))}
        </div>
        
        {/* Mobile swipe indicators - Only show on small screens when needed */}
        {liveGames.length > visibleGames && (
          <div className="xs:hidden flex justify-center space-x-1 mt-2">
            {Array.from({ length: Math.ceil(liveGames.length / visibleGames) }).map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index * visibleGames)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  currentIndex >= index * visibleGames && currentIndex < (index + 1) * visibleGames
                    ? 'bg-gray-600'
                    : 'bg-gray-300'
                }`}
                aria-label={`Go to page ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
  );
}

export default function DashboardHeader({ 
  onMobileMenuToggle, 
  isMobileMenuOpen = false 
}: DashboardHeaderProps) {
  const { user, profile, signOut } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  
  const userMenuRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSignOut = async () => {
    if (isSigningOut) return // Prevent double-click
    
    setIsSigningOut(true)
    try {
      console.log('Signing out...')
      await signOut()
      // The auth context will handle the redirect
    } catch (error) {
      console.error('Error signing out:', error)
      alert('Failed to sign out. Please try again.')
      setIsSigningOut(false)
    }
  }

  const handleUserMenuToggle = () => {
    setShowUserMenu(!showUserMenu)
    setShowNotifications(false)
  }

  const handleNotificationsToggle = () => {
    setShowNotifications(!showNotifications)
    setShowUserMenu(false)
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      {/* Top section - User controls */}
      <div className="flex items-center justify-between px-4 lg:px-6 py-3 lg:py-4">
        {/* Left side - Mobile menu button + Title */}
        <div className="flex items-center space-x-3 flex-1">
          {/* Mobile menu toggle - only show on mobile */}
          {onMobileMenuToggle && (
            <button
              onClick={onMobileMenuToggle}
              className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
            </button>
          )}

          {/* Logo - visible on mobile when sidebar is closed */}
          <div className="lg:hidden">
            <h1 className="text-lg font-bold text-gray-900">QuadraTrade</h1>
          </div>

          {/* Page title area - can be set by individual pages */}
          <div className="hidden lg:block">
            {/* This can be dynamically set by pages */}
          </div>
        </div>

        {/* Right side - Notifications & User menu */}
        <div className="flex items-center space-x-2 lg:space-x-4">
          {/* Balance - show on mobile (compact) and desktop */}
          <div className="hidden sm:block px-3 py-1.5 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500">Balance</div>
            <div className="text-sm font-semibold text-gray-900">
              ${profile?.balance?.toFixed(2) || '0.00'}
            </div>
          </div>

          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button 
              onClick={handleNotificationsToggle}
              className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Notifications"
            >
              <FiBell size={20} />
              {/* Notification badge */}
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
            </button>

            {/* Notifications dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {/* Sample notifications - replace with real data */}
                  <div className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">Your trade on Man United won!</p>
                        <p className="text-xs text-gray-500 mt-1">+$15.50 profit • 2h ago</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-3 hover:bg-gray-50 cursor-pointer">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-2 h-2 bg-gray-300 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">Market closing soon</p>
                        <p className="text-xs text-gray-500 mt-1">Arsenal vs Chelsea • 5h ago</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-2 border-t border-gray-100">
                  <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                    View all notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={handleUserMenuToggle}
              className="flex items-center space-x-2 lg:space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="User menu"
            >
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {profile?.username?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="text-left hidden md:block">
                <div className="text-sm font-medium text-gray-900">
                  {profile?.username || 'User'}
                </div>
                <div className="text-xs text-gray-500">
                  {user?.email?.substring(0, 20)}
                  {user?.email && user.email.length > 20 ? '...' : ''}
                </div>
              </div>
            </button>

            {/* User dropdown menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                {/* User info */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                      {profile?.username?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {profile?.username || 'User'}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {user?.email}
                      </div>
                    </div>
                  </div>
                  
                  {/* Balance - mobile only */}
                  <div className="sm:hidden mt-3 pt-3 border-t border-gray-100">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Balance</span>
                      <span className="text-sm font-semibold text-gray-900">
                        ${profile?.balance?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <button 
                    onClick={() => {
                      setShowUserMenu(false)
                      // Navigate to profile
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <FiUser className="mr-3" size={16} />
                    View Profile
                  </button>
                  <button 
                    onClick={() => {
                      setShowUserMenu(false)
                      setShowNotifications(true)
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <FiBell className="mr-3" size={16} />
                    Notifications
                  </button>
                </div>

                {/* Sign out */}
                <div className="border-t border-gray-100 py-1">
                  <button
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSigningOut ? (
                      <>
                        <div className="mr-3 w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                        Signing out...
                      </>
                    ) : (
                      <>
                        <FiLogOut className="mr-3" size={16} />
                        Sign Out
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom section - Live scores carousel */}
      <ScoreCarousel />
    </header>
  )
}
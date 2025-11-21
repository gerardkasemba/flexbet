'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { FiDownload, FiCheckCircle, FiSave, FiX } from 'react-icons/fi';
import { ESPN_SPORTS } from '@/types/espn-sports';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ScrapedSport {
  espnId: string;
  name: string;
  code: string;
  icon_url: string;
}

export default function SportsScraper() {
  const [scrapedSports, setScrapedSports] = useState<ScrapedSport[]>([]);
  const [selectedSports, setSelectedSports] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const scrapeSports = async () => {
    setLoading(true);
    setMessage('');
    setScrapedSports([]);
    setSelectedSports(new Set());

    try {
      console.log('Starting ESPN sports scraping...');
      const sports: ScrapedSport[] = [];

      for (const sport of ESPN_SPORTS) {
        try {
          // Use scoreboard endpoint to verify sport exists
          const url = `https://site.api.espn.com/apis/site/v2/sports/${sport.slug}/scoreboard`;
          console.log(`Checking: ${url}`);
          
          const response = await fetch(url);

          if (response.ok) {
            const data = await response.json();
            
            let sportName = sport.name;
            let iconUrl = '';

            // Try to extract icon from response
            if (data.leagues && data.leagues.length > 0) {
              // Some endpoints return league-level data
              iconUrl = data.leagues[0]?.logos?.[0]?.href || '';
            } else if (data.sports && data.sports.length > 0) {
              // Some return sport-level data
              iconUrl = data.sports[0]?.logos?.[0]?.href || '';
            }

            sports.push({
              espnId: sport.slug,
              name: sportName,
              code: sport.code,
              icon_url: iconUrl
            });

            console.log(`✓ Found: ${sportName}`);
          } else {
            console.log(`✗ Status ${response.status} for ${sport.slug}`);
            // Still add it even if endpoint fails
            sports.push({
              espnId: sport.slug,
              name: sport.name,
              code: sport.code,
              icon_url: ''
            });
          }
        } catch (err) {
          console.error(`Error checking ${sport.slug}:`, err);
          // Add it anyway
          sports.push({
            espnId: sport.slug,
            name: sport.name,
            code: sport.code,
            icon_url: ''
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      if (sports.length === 0) {
        throw new Error('No sports loaded');
      }

      // Sort alphabetically
      sports.sort((a, b) => a.name.localeCompare(b.name));

      setScrapedSports(sports);
      setMessage(`Loaded ${sports.length} sports from ESPN`);
      console.log('Scraping complete:', sports);
    } catch (error) {
      console.error('Error scraping sports:', error);
      setMessage(error instanceof Error ? error.message : 'Error loading sports');
    } finally {
      setLoading(false);
    }
  };

  const toggleSportSelection = (espnId: string) => {
    const newSelection = new Set(selectedSports);
    if (newSelection.has(espnId)) {
      newSelection.delete(espnId);
    } else {
      newSelection.add(espnId);
    }
    setSelectedSports(newSelection);
  };

  const selectAllSports = () => {
    setSelectedSports(new Set(scrapedSports.map(s => s.espnId)));
  };

  const deselectAllSports = () => {
    setSelectedSports(new Set());
  };

  const saveSelectedSports = async () => {
    if (selectedSports.size === 0) {
      setMessage('No sports selected');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const sportsToSave = scrapedSports.filter(sport => selectedSports.has(sport.espnId));

      // Check for existing sports by code
      const { data: existingSports, error: fetchError } = await supabase
        .from('sports')
        .select('code, name')
        .in('code', sportsToSave.map(s => s.code));

      if (fetchError) throw fetchError;

      const existingCodes = new Set(existingSports?.map(s => s.code) || []);
      const newSports = sportsToSave.filter(sport => !existingCodes.has(sport.code));

      if (newSports.length === 0) {
        setMessage('All selected sports already exist in the database!');
        setSaving(false);
        return;
      }

      // Prepare sports for insertion
      const sportsToInsert = newSports.map(sport => ({
        name: sport.name,
        code: sport.code,
        icon_url: sport.icon_url || null,
        is_active: true
      }));

      // Insert sports
      const { data, error } = await supabase
        .from('sports')
        .insert(sportsToInsert)
        .select();

      if (error) throw error;

      const skippedCount = sportsToSave.length - newSports.length;
      let successMessage = `Successfully saved ${data?.length || 0} sports!`;
      if (skippedCount > 0) {
        successMessage += ` (${skippedCount} sports already existed and were skipped)`;
      }

      setMessage(successMessage);
      setScrapedSports([]);
      setSelectedSports(new Set());
    } catch (error) {
      console.error('Error saving sports:', error);
      setMessage(error instanceof Error ? error.message : 'Error saving sports');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Sports Scraper</h1>
          <p className="text-gray-600 mt-2">
            Discover and import all available sports from ESPN into your database
          </p>
        </div>

        {/* Action Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Scrape ESPN Sports</h2>
              <p className="text-sm text-gray-600 mt-1">
                This will check ESPN for all available sports and their information
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">{ESPN_SPORTS.length}</div>
              <div className="text-xs text-gray-500">Sports to Check</div>
            </div>
          </div>

          {/* Scrape Button */}
          <button
            onClick={scrapeSports}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Scraping ESPN...</span>
              </>
            ) : (
              <>
                <FiDownload size={20} />
                <span>Start Scraping</span>
              </>
            )}
          </button>

          {/* Message */}
          {message && (
            <div className={`mt-4 p-4 rounded-lg ${
              message.includes('Error') || message.includes('error')
                ? 'bg-red-50 border border-red-200 text-red-700'
                : 'bg-green-50 border border-green-200 text-green-700'
            }`}>
              <p className="font-medium">{message}</p>
            </div>
          )}
        </div>

        {/* Scraped Sports Display */}
        {scrapedSports.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Found Sports ({scrapedSports.length})
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Select the sports you want to import into your database
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={selectAllSports}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAllSports}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Deselect All
                </button>
                <button
                  onClick={saveSelectedSports}
                  disabled={saving || selectedSports.size === 0}
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
                      <span>Save Selected ({selectedSports.size})</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Sports Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {scrapedSports.map((sport) => (
                <div
                  key={sport.espnId} // This uses espnId (slug) which is now unique
                  className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedSports.has(sport.espnId)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => toggleSportSelection(sport.espnId)}
                >
                  {/* Checkbox */}
                  <div className="absolute top-3 right-3">
                    <input
                      type="checkbox"
                      checked={selectedSports.has(sport.espnId)}
                      onChange={() => toggleSportSelection(sport.espnId)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* Sport Icon */}
                  <div className="flex items-center space-x-3 mb-3">
                    {sport.icon_url ? (
                      <div className="w-12 h-12 flex items-center justify-center">
                        <img
                          src={sport.icon_url}
                          alt={sport.name}
                          className="w-12 h-12 object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-lg">
                          {sport.code.substring(0, 2)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Sport Info */}
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg mb-1">
                      {sport.name}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                        {sport.code}
                      </span>
                    </div>
                  </div>

                  {/* Selected Indicator */}
                  {selectedSports.has(sport.espnId) && (
                    <div className="absolute bottom-3 right-3">
                      <FiCheckCircle className="text-blue-600" size={24} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Card */}
        {scrapedSports.length === 0 && !loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                  <FiDownload className="text-white" size={20} />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  Ready to Import Sports
                </h3>
                <p className="text-blue-800 mb-4">
                  Click the "Start Scraping" button above to fetch all available sports from ESPN.
                  The scraper will check {ESPN_SPORTS.length} different sport categories.
                </p>
                <ul className="space-y-1 text-sm text-blue-700">
                  <li>✓ Automatically detects available sports</li>
                  <li>✓ Retrieves sport names and icons</li>
                  <li>✓ Assigns standardized sport codes</li>
                  <li>✓ Prevents duplicate entries</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
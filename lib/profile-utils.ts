import { createClient } from './supabase/client'
import { Profile, ProfileUpdate, PublicProfile, TradingStats, canUserTrade } from '@/types/profile'

/**
 * Get user profile with retry logic
 * This is more robust and handles network issues better
 */
export async function getProfile(
  userId: string, 
  retries: number = 3
): Promise<Profile | null> {
  const supabase = createClient()
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        // If it's a "not found" error, don't retry
        if (error.code === 'PGRST116') {
          console.warn(`Profile not found for user ${userId}`)
          
          // Try to create profile if it doesn't exist
          if (attempt === 1) {
            console.log('Attempting to create missing profile...')
            const created = await createProfileIfMissing(userId)
            if (created) continue // Retry to fetch the newly created profile
          }
          
          return null
        }

        // For other errors, retry
        if (attempt < retries) {
          console.warn(`Error fetching profile (attempt ${attempt}/${retries}):`, error.message)
          await sleep(1000 * attempt) // Exponential backoff
          continue
        }

        console.error('Error fetching profile after all retries:', error)
        return null
      }

      return data
    } catch (error) {
      console.error(`Exception fetching profile (attempt ${attempt}/${retries}):`, error)
      if (attempt < retries) {
        await sleep(1000 * attempt)
        continue
      }
      return null
    }
  }

  return null
}

/**
 * Create profile if it doesn't exist
 * This handles the case where a user signs up but profile creation fails
 */
async function createProfileIfMissing(userId: string): Promise<boolean> {
  const supabase = createClient()
  
  try {
    // Get user email for username
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const username = user.email?.split('@')[0] || `user_${userId.substring(0, 8)}`

    const { error } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        username,
        email: user.email,
        balance: 1000, // Starting balance
        account_status: 'active'
      })

    if (error) {
      console.error('Error creating profile:', error)
      return false
    }

    console.log('✅ Profile created successfully')
    return true
  } catch (error) {
    console.error('Exception creating profile:', error)
    return false
  }
}

/**
 * Helper function for delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  const supabase = createClient()
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        username,
        avatar_url,
        level,
        total_trades,
        win_rate,
        lifetime_profit_loss,
        streak_days,
        is_public,
        created_at
      `)
      .eq('id', userId)
      .eq('is_public', true)
      .eq('account_status', 'active')
      .is('deleted_at', null)
      .single()

    if (error) {
      console.error('Error fetching public profile:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Exception fetching public profile:', error)
    return null
  }
}

export async function updateProfile(
  userId: string, 
  updates: ProfileUpdate
): Promise<Profile | null> {
  const supabase = createClient()
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating profile:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('Exception updating profile:', error)
    throw error
  }
}

export async function getTradingStats(userId: string): Promise<TradingStats | null> {
  const supabase = createClient()
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        balance,
        total_trades,
        winning_trades,
        losing_trades,
        win_rate,
        lifetime_profit_loss,
        best_trade_profit,
        worst_trade_loss,
        level,
        experience_points
      `)
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching trading stats:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Exception fetching trading stats:', error)
    return null
  }
}

export async function getLeaderboard(limit: number = 50): Promise<PublicProfile[]> {
  const supabase = createClient()
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        username,
        avatar_url,
        level,
        total_trades,
        win_rate,
        lifetime_profit_loss,
        streak_days,
        is_public,
        created_at
      `)
      .eq('is_public', true)
      .eq('account_status', 'active')
      .is('deleted_at', null)
      .order('lifetime_profit_loss', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching leaderboard:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Exception fetching leaderboard:', error)
    return []
  }
}

export async function incrementUserStats(
  userId: string, 
  stats: {
    tradeAmount?: number
    isWin?: boolean
    profitLoss?: number
  }
): Promise<void> {
  const supabase = createClient()
  
  try {
    // First get current profile to calculate new values
    const currentProfile = await getProfile(userId)
    if (!currentProfile) {
      throw new Error('Profile not found')
    }

    // Calculate new values
    const newTotalTrades = currentProfile.total_trades + 1
    const newWinningTrades = stats.isWin ? currentProfile.winning_trades + 1 : currentProfile.winning_trades
    const newLifetimeProfitLoss = currentProfile.lifetime_profit_loss + (stats.profitLoss || 0)
    
    const newBestTradeProfit = stats.profitLoss && stats.profitLoss > 0 && stats.profitLoss > currentProfile.best_trade_profit 
      ? stats.profitLoss 
      : currentProfile.best_trade_profit
    
    const newWorstTradeLoss = stats.profitLoss && stats.profitLoss < 0 && stats.profitLoss < currentProfile.worst_trade_loss 
      ? stats.profitLoss 
      : currentProfile.worst_trade_loss

    const updateData: any = {
      total_trades: newTotalTrades,
      winning_trades: newWinningTrades,
      losing_trades: newTotalTrades - newWinningTrades,
      lifetime_profit_loss: newLifetimeProfitLoss,
      last_trade_at: new Date().toISOString()
    }

    if (stats.profitLoss !== undefined) {
      if (stats.profitLoss > 0) {
        updateData.best_trade_profit = newBestTradeProfit
      } else {
        updateData.worst_trade_loss = newWorstTradeLoss
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)

    if (error) {
      console.error('Error updating user stats:', error)
      throw error
    }

    // Update streak
    await updateUserStreak(userId)
  } catch (error) {
    console.error('Exception in incrementUserStats:', error)
    throw error
  }
}

export async function updateUserBalance(
  userId: string, 
  amount: number, 
  type: 'deposit' | 'withdrawal' | 'trade'
): Promise<void> {
  const supabase = createClient()
  
  try {
    const currentProfile = await getProfile(userId)
    if (!currentProfile) {
      throw new Error('Profile not found')
    }

    const updateData: any = {
      balance: currentProfile.balance + amount
    }

    if (type === 'deposit') {
      updateData.lifetime_deposits = currentProfile.lifetime_deposits + Math.abs(amount)
    } else if (type === 'withdrawal') {
      updateData.lifetime_withdrawals = currentProfile.lifetime_withdrawals + Math.abs(amount)
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)

    if (error) {
      console.error('Error updating user balance:', error)
      throw error
    }
  } catch (error) {
    console.error('Exception updating user balance:', error)
    throw error
  }
}

export async function updateUserStreak(userId: string): Promise<void> {
  const supabase = createClient()
  
  try {
    const { error } = await supabase.rpc('update_user_streak', { user_id: userId })
    
    if (error) {
      console.error('Error updating user streak:', error)
      throw error
    }
  } catch (error) {
    console.error('Exception updating user streak:', error)
    throw error
  }
}

export async function checkTradingEligibility(
  userId: string
): Promise<{ canTrade: boolean; reasons: string[] }> {
  try {
    const profile = await getProfile(userId)
    
    if (!profile) {
      return { canTrade: false, reasons: ['Profile not found'] }
    }

    return canUserTrade(profile)
  } catch (error) {
    console.error('Exception checking trading eligibility:', error)
    return { canTrade: false, reasons: ['Error checking eligibility'] }
  }
}

export async function verifyUserAge(
  userId: string, 
  dateOfBirth: string
): Promise<boolean> {
  try {
    const birthDate = new Date(dateOfBirth)
    const today = new Date()
    const age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    
    const isAdult = age > 18 || (age === 18 && monthDiff >= 0 && today.getDate() >= birthDate.getDate())

    if (isAdult) {
      const { error } = await createClient()
        .from('profiles')
        .update({ 
          age_verified: true,
          date_of_birth: dateOfBirth
        })
        .eq('id', userId)

      if (error) {
        console.error('Error updating age verification:', error)
        return false
      }
    }

    return isAdult
  } catch (error) {
    console.error('Exception verifying user age:', error)
    return false
  }
}

/**
 * Force refresh profile - useful when you know profile exists but might be cached
 */
export async function forceRefreshProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient()
  
  try {
    // Add timestamp to bypass any caching
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error force refreshing profile:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Exception force refreshing profile:', error)
    return null
  }
}
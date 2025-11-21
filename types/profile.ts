export type Profile = {
  // Primary Key
  id: string
  admin_role: string
  is_admin?: boolean
  permissions?: string[]
  // Basic Profile Information
  username: string
  email: string
  full_name?: string
  phone_number?: string
  date_of_birth?: string
  
  // Avatar/Profile Picture
  avatar_url?: string
  
  // Location Information
  country?: string
  city?: string
  timezone?: string
  
  // Financial Information
  balance: number
  currency: string
  lifetime_deposits: number
  lifetime_withdrawals: number
  lifetime_profit_loss: number
  
  // Trading Statistics
  total_trades: number
  winning_trades: number
  losing_trades: number
  win_rate: number
  best_trade_profit: number
  worst_trade_loss: number
  
  // Verification & Compliance
  kyc_status: 'unverified' | 'pending' | 'verified' | 'rejected'
  kyc_verified_at?: string
  kyc_provider_id?: string
  email_verified: boolean
  phone_verified: boolean
  age_verified: boolean
  
  // Account Status
  account_status: 'active' | 'suspended' | 'banned' | 'closed'
  suspension_reason?: string
  suspended_until?: string
  
  // Risk & Limits
  daily_trade_limit: number
  max_position_size: number
  withdrawal_limit_daily: number
  withdrawal_limit_weekly: number
  risk_level: 'low' | 'standard' | 'high'
  
  // Preferences
  notifications_enabled: boolean
  email_notifications: boolean
  sms_notifications: boolean
  push_notifications: boolean
  marketing_emails: boolean
  preferred_language: string
  theme: 'light' | 'dark' | 'auto'
  
  // Social Features
  is_public: boolean
  allow_friend_requests: boolean
  show_trade_history: boolean
  bio?: string
  
  // Gamification
  level: number
  experience_points: number
  achievement_count: number
  badges: string[]
  streak_days: number
  longest_streak: number
  last_active_date?: string
  
  // Referral System
  referral_code: string
  referred_by_code?: string
  referral_earnings: number
  total_referrals: number
  
  // Security
  two_factor_enabled: boolean
  two_factor_method?: 'sms' | 'email' | 'authenticator'
  last_login_at?: string
  last_login_ip?: string
  failed_login_attempts: number
  locked_until?: string
  
  // Payment Methods
  default_payment_method_id?: string
  payment_methods: string[]
  
  // Metadata
  created_at: string
  updated_at: string
  last_trade_at?: string
  deleted_at?: string
  
  // Additional Notes
  admin_notes?: string
  tags: string[]
}

export type PublicProfile = Pick<Profile,
  | 'id'
  | 'username'
  | 'avatar_url'
  | 'level'
  | 'total_trades'
  | 'win_rate'
  | 'lifetime_profit_loss'
  | 'streak_days'
  | 'is_public'
  | 'created_at'
>

export type ProfileUpdate = Partial<Pick<Profile,
  | 'username'
  | 'full_name'
  | 'phone_number'
  | 'avatar_url'
  | 'country'
  | 'city'
  | 'timezone'
  | 'preferred_language'
  | 'theme'
  | 'is_public'
  | 'allow_friend_requests'
  | 'show_trade_history'
  | 'bio'
  | 'notifications_enabled'
  | 'email_notifications'
  | 'sms_notifications'
  | 'push_notifications'
  | 'marketing_emails'
>>

export type TradingStats = Pick<Profile,
  | 'balance'
  | 'total_trades'
  | 'winning_trades'
  | 'losing_trades'
  | 'win_rate'
  | 'lifetime_profit_loss'
  | 'best_trade_profit'
  | 'worst_trade_loss'
  | 'level'
  | 'experience_points'
>

// Type guard functions
export function canUserTrade(profile: Profile): { canTrade: boolean; reasons: string[] } {
  const reasons: string[] = []

  if (profile.account_status !== 'active') {
    reasons.push('Account is not active')
  }

  if (!profile.age_verified) {
    reasons.push('Age verification required (must be 18+)')
  }

  if (profile.balance <= 0) {
    reasons.push('Insufficient balance')
  }

  if (profile.suspended_until && new Date(profile.suspended_until) > new Date()) {
    reasons.push('Account suspended')
  }

  if (profile.kyc_status !== 'verified') {
    reasons.push('KYC verification required')
  }

  return {
    canTrade: reasons.length === 0,
    reasons
  }
}

export function isProfileComplete(profile: Profile): boolean {
  return (
    profile.age_verified &&
    profile.email_verified &&
    profile.kyc_status === 'verified' &&
    profile.account_status === 'active'
  )
}

// Utility functions
export function calculateLevel(experiencePoints: number): number {
  return Math.floor(Math.sqrt(experiencePoints / 100)) + 1
}

export function getNextLevelXP(currentLevel: number): number {
  return Math.pow(currentLevel, 2) * 100
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

export function getWinRateColor(winRate: number): string {
  if (winRate >= 60) return 'text-green-600'
  if (winRate >= 40) return 'text-yellow-600'
  return 'text-red-600'
}

export function getRiskLevelColor(riskLevel: Profile['risk_level']): string {
  switch (riskLevel) {
    case 'low': return 'text-green-600'
    case 'standard': return 'text-yellow-600'
    case 'high': return 'text-red-600'
    default: return 'text-gray-600'
  }
}

// Default profile values - now includes all required properties
// Default profile values - now includes all required properties
export const DEFAULT_PROFILE_VALUES: Partial<Profile> = {
  username: '',
  email: '',
  balance: 0,
  currency: 'USD',
  lifetime_deposits: 0,
  lifetime_withdrawals: 0,
  lifetime_profit_loss: 0,
  total_trades: 0,
  winning_trades: 0,
  losing_trades: 0,
  win_rate: 0,
  best_trade_profit: 0,
  worst_trade_loss: 0,
  kyc_status: 'unverified',
  email_verified: false,
  phone_verified: false,
  age_verified: false,
  account_status: 'active',
  daily_trade_limit: 500,
  max_position_size: 100,
  withdrawal_limit_daily: 1000,
  withdrawal_limit_weekly: 5000,
  risk_level: 'standard',
  notifications_enabled: true,
  email_notifications: true,
  sms_notifications: false,
  push_notifications: true,
  marketing_emails: false,
  preferred_language: 'en',
  theme: 'light',
  is_public: true,
  allow_friend_requests: true,
  show_trade_history: false,
  level: 1,
  experience_points: 0,
  achievement_count: 0,
  badges: [],
  streak_days: 0,
  longest_streak: 0,
  referral_code: '',
  referral_earnings: 0,
  total_referrals: 0,
  two_factor_enabled: false,
  failed_login_attempts: 0,
  payment_methods: [],
  tags: [],
  country: 'ZA',
  timezone: 'Africa/Johannesburg',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
} as const // ✅ Add 'as const' to fix the type inference

// Helper function to create a complete profile with defaults
export function createProfileWithDefaults(overrides: Partial<Profile> & { id: string; username: string; email: string }): Profile {
  return {
    ...DEFAULT_PROFILE_VALUES,
    ...overrides,
    // Ensure these are always set from overrides since they're required
    id: overrides.id,
    username: overrides.username,
    email: overrides.email
  } as Profile 
}

// Helper function to safely merge profile updates
// Helper function to safely merge profile updates
export function safeProfileUpdate(currentProfile: Profile, updates: ProfileUpdate): ProfileUpdate {
  const allowedFields: (keyof ProfileUpdate)[] = [
    'username', 'full_name', 'phone_number', 'avatar_url', 'country', 'city', 'timezone',
    'preferred_language', 'theme', 'is_public', 'allow_friend_requests', 'show_trade_history',
    'bio', 'notifications_enabled', 'email_notifications', 'sms_notifications', 'push_notifications',
    'marketing_emails'
  ]

  const safeUpdates: ProfileUpdate = {}
  
  allowedFields.forEach(field => {
    if (field in updates) {
      // ✅ Use type assertion to resolve the TypeScript error
      safeUpdates[field] = updates[field] as any
    }
  })

  return safeUpdates
}
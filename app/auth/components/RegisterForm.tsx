'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FaSpinner } from 'react-icons/fa'

type RegisterFormProps = {
  onSwitchToLogin: () => void
  onSuccess: () => void
}

export default function RegisterForm({ onSwitchToLogin, onSuccess }: RegisterFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isCheckingReferral, setIsCheckingReferral] = useState(false)
  const [referralValid, setReferralValid] = useState<boolean | null>(null)
  const supabase = createClient()

  // Check if referral code is valid
  const checkReferralCode = async (code: string) => {
    if (!code.trim()) {
      setReferralValid(null)
      return false
    }

    setIsCheckingReferral(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .eq('referral_code', code.trim().toUpperCase())
        .eq('account_status', 'active')
        .is('deleted_at', null)
        .single()

      if (error || !data) {
        setReferralValid(false)
        return false
      } else {
        setReferralValid(true)
        return true
      }
    } catch (error) {
      setReferralValid(false)
      return false
    } finally {
      setIsCheckingReferral(false)
    }
  }

  const handleReferralCodeChange = (code: string) => {
    setReferralCode(code)
    // Debounce the referral code check
    const timeoutId = setTimeout(() => {
      checkReferralCode(code)
    }, 500)
    return () => clearTimeout(timeoutId)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    // Age validation
    if (dateOfBirth) {
      const birthDate = new Date(dateOfBirth)
      const today = new Date()
      const age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age
      }
      
      if (age < 18) {
        setError('You must be at least 18 years old to register.')
        setIsLoading(false)
        return
      }
    }

    // Referral code validation
    if (!referralCode.trim()) {
      setError('Please enter a referral code to register.')
      setIsLoading(false)
      return
    }

    if (referralValid === false) {
      setError('Please enter a valid referral code.')
      setIsLoading(false)
      return
    }

    // Double-check referral code before registration
    if (referralValid !== true) {
      const isValid = await checkReferralCode(referralCode)
      if (!isValid) {
        setError('Please enter a valid referral code.')
        setIsLoading(false)
        return
      }
    }

    try {
      // First, verify the referral code exists and get the referrer's ID
      const { data: referrerData, error: referralError } = await supabase
        .from('profiles')
        .select('id')
        .eq('referral_code', referralCode.trim().toUpperCase())
        .single()

      if (referralError || !referrerData) {
        throw new Error('Invalid referral code. Please check and try again.')
      }

      // Create the user account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username || email.split('@')[0],
            full_name: fullName,
            date_of_birth: dateOfBirth,
            referred_by_code: referralCode.trim().toUpperCase()
          },
          emailRedirectTo: `${location.origin}/auth/callback`
        }
      })

      if (signUpError) throw signUpError

      if (authData.user) {
        // Update the profile with referral information and $20 bonus
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            referred_by_code: referralCode.trim().toUpperCase(),
            balance: 20.00, // $20 welcome bonus
            lifetime_deposits: 20.00, // Track as deposit for reporting
            updated_at: new Date().toISOString()
          })
          .eq('id', authData.user.id)

        if (profileError) {
          console.error('Error updating profile with referral:', profileError)
        }

        // Increment referrer's total_referrals count and give them $10 bonus
        const { error: updateReferrerError } = await supabase.rpc('increment_referral_count_and_bonus', {
          user_id: referrerData.id
        })

        if (updateReferrerError) {
          console.error('Error updating referrer count:', updateReferrerError)
        }

        // Create a transaction record for the welcome bonus
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert({
            user_id: authData.user.id,
            transaction_type: 'welcome_bonus',
            amount: 20.00,
            balance_change: 20.00,
            description: 'Welcome bonus for new account',
            status: 'completed',
            created_at: new Date().toISOString()
          })

        if (transactionError) {
          console.error('Error creating welcome bonus transaction:', transactionError)
        }
      }

      setShowConfirmation(true)
    } catch (error: any) {
      setError(error.message || 'An error occurred during registration')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendEmail = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback`
        }
      })
      if (error) throw error
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (showConfirmation) {
    return (
      <div className="p-6 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Check Your Email</h3>
        <p className="text-gray-600 mb-4">
          We've sent a confirmation link to <strong>{email}</strong>. Click the link to verify your account and start trading on FlexBet.
        </p>
        <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-center mb-2">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-2">
              <span className="text-white font-bold text-sm">$</span>
            </div>
            <span className="text-2xl font-bold text-green-700">20.00</span>
          </div>
          <p className="text-green-700 text-sm font-medium">
            Welcome bonus credited to your account! 🎉
          </p>
          <p className="text-green-600 text-xs mt-1">
            Start trading immediately after email verification
          </p>
        </div>
        {referralValid && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-700 text-sm">
              🎉 You were referred by {referralCode}! Your referrer also received a bonus.
            </p>
          </div>
        )}
        <div className="space-y-3">
          <button
            onClick={handleResendEmail}
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading && <FaSpinner className="animate-spin" />}
            Resend Confirmation Email
          </button>
          <button
            onClick={onSwitchToLogin}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Join FlexBet</h2>

      {/* Welcome Bonus Banner */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">🎁 Welcome Bonus!</h3>
            <p className="text-blue-100 text-sm">Get $20 free to start trading</p>
          </div>
          <div className="text-2xl font-bold">$20</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
            Full Name
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your full name"
          />
        </div>

        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
            Username *
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Choose a username"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email *
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your email"
          />
        </div>

        <div>
          <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-1">
            Date of Birth *
          </label>
          <input
            id="dateOfBirth"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">You must be 18 or older to trade on FlexBet</p>
        </div>

        <div>
          <label htmlFor="referralCode" className="block text-sm font-medium text-gray-700 mb-1">
            Referral Code *
          </label>
          <div className="relative">
            <input
              id="referralCode"
              type="text"
              value={referralCode}
              onChange={(e) => handleReferralCodeChange(e.target.value)}
              required
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10 ${
                referralValid === true ? 'border-green-500 bg-green-50' :
                referralValid === false ? 'border-red-500 bg-red-50' :
                'border-gray-300'
              }`}
              placeholder="Enter referral code (e.g., FLEX123)"
              style={{ textTransform: 'uppercase' }}
            />
            {isCheckingReferral && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <FaSpinner className="animate-spin text-gray-400" />
              </div>
            )}
            {referralValid === true && !isCheckingReferral && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            {referralValid === false && !isCheckingReferral && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {referralValid === true && <span className="text-green-600">✓ Valid referral code</span>}
            {referralValid === false && <span className="text-red-600">✗ Invalid referral code</span>}
            {referralValid === null && 'Ask a friend for their referral code to join'}
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password *
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Create a password (min. 6 characters)"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || referralValid === false}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg hover:from-blue-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg"
        >
          {isLoading && <FaSpinner className="animate-spin" />}
          Create Account & Get $20
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <button
          onClick={onSwitchToLogin}
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          Sign in
        </button>
      </div>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Don't have a referral code?</h4>
        <p className="text-blue-700 text-sm">
          FlexBet is currently invite-only. Ask an existing member for their referral code to join our trading community and get your $20 welcome bonus.
        </p>
      </div>
    </div>
  )
}
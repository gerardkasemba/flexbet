'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  FaWhatsapp, 
  FaFacebookMessenger, 
  FaEnvelope, 
  FaLink, 
  FaShareAlt,
  FaTimes,
  FaCopy,
  FaCheck,
  FaSms,
  FaTelegram
} from 'react-icons/fa'
import { FiShare2 } from 'react-icons/fi'

interface InviteFriendsProps {
  className?: string
  variant?: 'button' | 'icon'
}

interface UserProfile {
  referral_code: string
  username: string
}

export default function InviteFriends({ className = '', variant = 'button' }: InviteFriendsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchUserProfile()
  }, [])

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('referral_code, username')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        return
      }

      setUserProfile(profile)
    } catch (error) {
      console.error('Error in fetchUserProfile:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const generateInviteMessage = () => {
    if (!userProfile?.referral_code) return ''
    
    const inviteUrl = generateInviteUrl()
    
    return `Join me on FlexBet - the ultimate sports trading platform!
        Use my referral code: ${userProfile.referral_code}

        Get $20 free when you sign up and start trading on real sports markets.
        Sign up here: ${inviteUrl}

        Let's trade together!`
  }

  const generateInviteUrl = () => {
    if (!userProfile?.referral_code) {
      return typeof window !== 'undefined' 
        ? `${window.location.origin}` 
        : '/'
    }
    
    return typeof window !== 'undefined'
      ? `${window.location.origin}/?ref=${userProfile.referral_code}`
      : `/?ref=${userProfile.referral_code}`
  }

  const shareOnWhatsApp = () => {
    const message = encodeURIComponent(generateInviteMessage())
    window.open(`https://wa.me/?text=${message}`, '_blank', 'noopener,noreferrer')
  }

  const shareOnMessenger = () => {
    const url = encodeURIComponent(generateInviteUrl())
    window.open(`fb-messenger://share/?link=${url}`, '_blank', 'noopener,noreferrer')
  }

  const shareOnTelegram = () => {
    const message = encodeURIComponent(generateInviteMessage())
    const url = encodeURIComponent(generateInviteUrl())
    window.open(`https://t.me/share/url?url=${url}&text=${message}`, '_blank', 'noopener,noreferrer')
  }

  const shareViaSMS = () => {
    const message = encodeURIComponent(generateInviteMessage())
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      window.open(`sms:?&body=${message}`, '_blank')
    } else {
      copyToClipboard()
    }
  }

  const shareViaEmail = () => {
    const subject = encodeURIComponent('Join me on FlexBet!')
    const body = encodeURIComponent(generateInviteMessage())
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank')
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateInviteMessage())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      const textArea = document.createElement('textarea')
      textArea.value = generateInviteMessage()
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(generateInviteUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      const textArea = document.createElement('textarea')
      textArea.value = generateInviteUrl()
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const shareNative = async () => {
    // ✅ Fixed: Proper check for navigator.share support
    if (typeof navigator !== 'undefined' && 'share' in navigator && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Join FlexBet',
          text: generateInviteMessage(),
          url: generateInviteUrl(),
        })
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.log('Error sharing:', err)
          copyLink()
        }
      }
    } else {
      copyLink()
    }
  }

  const sharingOptions = [
    {
      name: 'WhatsApp',
      icon: FaWhatsapp,
      color: 'bg-[#25D366] hover:bg-[#128C7E]',
      textColor: 'text-white',
      action: shareOnWhatsApp
    },
    {
      name: 'Messenger',
      icon: FaFacebookMessenger,
      color: 'bg-[#0084FF] hover:bg-[#0066CC]',
      textColor: 'text-white',
      action: shareOnMessenger
    },
    {
      name: 'Telegram',
      icon: FaTelegram,
      color: 'bg-[#0088cc] hover:bg-[#006699]',
      textColor: 'text-white',
      action: shareOnTelegram
    },
    {
      name: 'SMS',
      icon: FaSms,
      color: 'bg-green-500 hover:bg-green-600',
      textColor: 'text-white',
      action: shareViaSMS
    },
    {
      name: 'Email',
      icon: FaEnvelope,
      color: 'bg-gray-600 hover:bg-gray-700',
      textColor: 'text-white',
      action: shareViaEmail
    },
    {
      name: 'Copy Link',
      icon: copied ? FaCheck : FaLink,
      color: copied ? 'bg-green-500' : 'bg-purple-500 hover:bg-purple-600',
      textColor: 'text-white',
      action: copyLink
    }
  ]

  if (isLoading) {
    return (
      <button
        disabled
        className={`flex items-center justify-center gap-2 px-4 py-2 bg-gray-300 text-gray-600 rounded-lg cursor-not-allowed ${className}`}
      >
        <FiShare2 className="animate-spin" />
        Loading...
      </button>
    )
  }

  if (!userProfile?.referral_code) {
    return (
      <button
        disabled
        className={`flex items-center justify-center gap-2 px-4 py-2 bg-gray-300 text-gray-600 rounded-lg cursor-not-allowed ${className}`}
      >
        <FiShare2 />
        Invite Friends
      </button>
    )
  }

  return (
<>
  {/* Trigger Button - Desktop optimized */}
  <div className="w-full bg-orange-500 mb-6 text-white rounded-xl p-6 flex flex-col lg:flex-row items-center justify-between shadow-sm">
    {/* Left side: Title + Subtitle */}
    <div className="text-center lg:text-left mb-4 lg:mb-0 lg:mr-6 flex-1">
      <h3 className="text-xl font-semibold">Invite Friends</h3>
      <p className="text-orange-100 mt-2 max-w-2xl">
        Share FlexBet with your friends and earn rewards when they start trading.
      </p>
    </div>

    {/* Right side: Button */}
    <button
      onClick={() => setIsOpen(true)}
      className="w-full lg:w-auto px-6 py-3 bg-white text-orange-700 rounded-lg font-semibold hover:bg-orange-50 transition-all flex items-center justify-center gap-3 text-base hover:scale-105 active:scale-95"
    >
      <FiShare2 className="text-orange-700" size={20} />
      Invite Now
    </button>
  </div>

  {/* Modal */}
  {isOpen && (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
        
        {/* Modal Container - Responsive sizing */}
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm sm:max-w-md lg:max-w-lg xl:max-w-xl mx-auto max-h-[90vh] lg:max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
            <h3 className="text-xl font-bold text-gray-900">Invite Friends</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close"
            >
              <FaTimes className="text-gray-500 text-lg" />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {/* Referral Code Display */}
            <div className="bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-5">
              <div className="text-center">
                <p className="text-base text-gray-600 mb-3">Your Referral Code</p>
                <div className="flex items-center justify-center space-x-3">
                  <code className="text-2xl lg:text-3xl font-bold text-orange-700 bg-white px-4 py-3 rounded-lg border-2 font-mono">
                    {userProfile.referral_code}
                  </code>
                  <button
                    onClick={copyToClipboard}
                    className="p-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors hover:scale-105"
                    title="Copy message"
                    aria-label="Copy referral code"
                  >
                    {copied ? <FaCheck size={18} /> : <FaCopy size={18} />}
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-3">
                  Share this code or use the options below
                </p>
              </div>
            </div>

            {/* Preview Message */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
              <h4 className="text-base font-medium text-gray-700 mb-3">Preview Message</h4>
              <div className="text-sm text-gray-600 whitespace-pre-line bg-white p-4 rounded-lg border text-left max-h-40 overflow-y-auto leading-relaxed">
                {generateInviteMessage()}
              </div>
            </div>

            {/* Sharing Options */}
            <div>
              <h4 className="text-base font-medium text-gray-700 mb-4">Share via</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {sharingOptions.map((option) => {
                  const Icon = option.icon
                  return (
                    <button
                      key={option.name}
                      onClick={option.action}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl transition-all hover:scale-105 active:scale-95 ${option.color} ${option.textColor} min-h-[80px]`}
                      aria-label={`Share via ${option.name}`}
                    >
                      <Icon size={24} className="mb-2" />
                      <span className="text-sm font-medium text-center">{option.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Native Share - Only show if supported */}
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={shareNative}
                className="w-full flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl hover:from-orange-700 hover:to-orange-800 transition-all hover:scale-105 text-base font-semibold"
              >
                <FaShareAlt size={20} />
                Share via Device
              </button>
            )}

            {/* Rewards Info */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-sm font-bold">$</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-medium text-yellow-800">Earn Rewards</h4>
                  <p className="text-yellow-700 mt-2 leading-relaxed">
                    You get <strong>$10</strong> for each friend who signs up and they get <strong>$20</strong> to start trading!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <button
              onClick={copyToClipboard}
              className="w-full flex items-center justify-center gap-3 py-3 px-6 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors hover:scale-105 text-base font-medium"
            >
              {copied ? <FaCheck className="text-green-600" size={18} /> : <FaCopy size={18} />}
              {copied ? 'Copied to Clipboard!' : 'Copy Invite Message'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )}
</>
  )
}
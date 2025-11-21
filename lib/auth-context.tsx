'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { createClient } from './supabase/client'
import { useRouter, usePathname } from 'next/navigation' // ✅ Add usePathname
import { Profile } from '@/types/profile'
import { getProfile } from './profile-utils'

type AuthContextType = {
  user: any
  profile: Profile | null
  isLoading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  signOut: async () => {},
  refreshProfile: async () => {}
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname() // ✅ Get current path
  
  // Use refs to track mounted state and prevent race conditions
  const mountedRef = useRef(true)
  const profileFetchRef = useRef<Promise<void> | null>(null)
  const isInitialMount = useRef(true) // ✅ Track initial mount

  const refreshProfile = async () => {
    if (!user?.id) {
      setProfile(null)
      return
    }

    try {
      if (!profileFetchRef.current) {
        profileFetchRef.current = getProfile(user.id)
          .then((userProfile) => {
            if (mountedRef.current) {
              setProfile(userProfile)
            }
          })
          .catch((error) => {
            console.error('Error refreshing profile:', error)
            if (mountedRef.current) {
              setProfile(null)
            }
          })
          .finally(() => {
            profileFetchRef.current = null
          })
      }

      await profileFetchRef.current
    } catch (error) {
      console.error('Error in refreshProfile:', error)
      if (mountedRef.current) {
        setProfile(null)
      }
    }
  }

  const fetchProfileWithRetry = async (userId: string, retries = 2): Promise<Profile | null> => {
    try {
      return await getProfile(userId)
    } catch (error) {
      if (retries > 0) {
        console.log(`Retrying profile fetch... ${retries} attempts left`)
        await new Promise(resolve => setTimeout(resolve, 1000))
        return fetchProfileWithRetry(userId, retries - 1)
      }
      throw error
    }
  }

  useEffect(() => {
    mountedRef.current = true

    const initializeAuth = async () => {
      try {
        const [
          { data: { session } },
          { data: { user: currentUser }, error: userError }
        ] = await Promise.all([
          supabase.auth.getSession(),
          supabase.auth.getUser()
        ])

        if (!mountedRef.current) return

        if (userError || !currentUser || !session) {
          console.log('No valid session found')
          setUser(null)
          setProfile(null)
          setIsLoading(false)
          return
        }

        setUser(currentUser)
        
        try {
          const userProfile = await fetchProfileWithRetry(currentUser.id)
          if (mountedRef.current) {
            setProfile(userProfile)
          }
        } catch (profileError) {
          console.error('Failed to fetch profile after retries:', profileError)
          if (mountedRef.current) {
            setProfile(null)
          }
        }
        
        if (mountedRef.current) {
          setIsLoading(false)
          isInitialMount.current = false // ✅ Mark initial mount complete
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        if (mountedRef.current) {
          setUser(null)
          setProfile(null)
          setIsLoading(false)
        }
      }
    }

    initializeAuth()

    let authChangeTimeout: NodeJS.Timeout
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mountedRef.current) return

        clearTimeout(authChangeTimeout)
        authChangeTimeout = setTimeout(async () => {
          try {
            console.log('Auth event:', event, 'User:', !!session?.user)

            setUser(session?.user ?? null)
            
            if (session?.user) {
              try {
                const userProfile = await fetchProfileWithRetry(session.user.id)
                if (mountedRef.current) {
                  setProfile(userProfile)
                }
              } catch (profileError) {
                console.error('Error fetching profile on auth change:', profileError)
                if (mountedRef.current) {
                  setProfile(null)
                }
              }
            } else {
              if (mountedRef.current) {
                setProfile(null)
              }
            }
            
            if (mountedRef.current) {
              setIsLoading(false)
            }
            
            // ✅ FIXED: Only redirect on SIGNED_IN if not already on dashboard
            // and skip redirect if this is from initial mount or token refresh
            switch (event) {
              case 'SIGNED_IN':
                // Only redirect if:
                // 1. Not on initial mount (prevents redirect on page load)
                // 2. Not already on a dashboard route
                if (!isInitialMount.current && !pathname.startsWith('/dashboard')) {
                  console.log('User signed in, redirecting to dashboard')
                  router.push('/dashboard')
                } else {
                  console.log('User signed in, but already on dashboard - staying put')
                }
                break
                
              case 'SIGNED_OUT':
                console.log('User signed out, redirecting to home')
                if (mountedRef.current) {
                  setProfile(null)
                }
                router.push('/')
                break
                
              case 'TOKEN_REFRESHED':
                console.log('Token refreshed - no redirect needed')
                // ✅ Don't redirect on token refresh
                if (session?.user?.id) {
                  refreshProfile()
                }
                break
                
              case 'USER_UPDATED':
                console.log('User updated - no redirect needed')
                // ✅ Don't redirect on user update
                if (session?.user?.id) {
                  refreshProfile()
                }
                break
            }

            // ✅ Only refresh router, don't force navigation
            router.refresh()

          } catch (error) {
            console.error('Auth state change error:', error)
            if (mountedRef.current) {
              setIsLoading(false)
            }
          }
        }, 100)
      }
    )

    return () => {
      mountedRef.current = false
      clearTimeout(authChangeTimeout)
      subscription.unsubscribe()
    }
  }, [supabase, router, pathname]) // ✅ Add pathname to dependencies

  const signOut = async () => {
    try {
      setIsLoading(true)
      
      setUser(null)
      setProfile(null)
      
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('Sign out error:', error)
      }

      router.push('/')
      router.refresh()
      
    } catch (error) {
      console.error('Sign out failed:', error)
      setUser(null)
      setProfile(null)
      router.push('/')
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }

  const value: AuthContextType = {
    user,
    profile,
    isLoading,
    signOut,
    refreshProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
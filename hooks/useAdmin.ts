'use client'

import { useAuth } from '@/lib/auth-context'
import { isUserAdmin, hasPermission } from '@/lib/admin-utils'
import { useState, useEffect } from 'react'

export function useAdmin() {
  const { user, profile } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false)
        setIsLoading(false)
        return
      }

      try {
        const adminStatus = await isUserAdmin(user.id)
        setIsAdmin(adminStatus)
      } catch (error) {
        console.error('Error checking admin status:', error)
        setIsAdmin(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAdminStatus()
  }, [user])

  const checkPermission = (permission: string): boolean => {
    // ✅ Cast the profile to the expected type or handle the type mismatch
    return hasPermission(profile as any, permission)
  }

  return {
    isAdmin,
    isLoading: isLoading || !user,
    hasPermission: checkPermission,
    isSuperAdmin: profile?.admin_role === 'super_admin' || profile?.email === 'gerardkasemba@gmail.com'
  }
}
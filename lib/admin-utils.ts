import { createClient } from './supabase/client'
import { Profile } from '@/types/profile'

export const ADMIN_EMAIL = 'gerardkasemba@gmail.com'

// Extended Profile type with admin fields
interface AdminProfile extends Profile {
  is_admin?: boolean
  permissions?: string[]
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin, email')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error checking admin status:', error)
    return false
  }

  return data?.is_admin === true || data?.email === ADMIN_EMAIL
}

export async function getAdminUsers(): Promise<AdminProfile[]> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_admin', true)
    .eq('account_status', 'active')
    .is('deleted_at', null)
    .order('created_at', { ascending: true }) // ✅ Fixed: use object instead of string

  if (error) {
    console.error('Error fetching admin users:', error)
    return []
  }

  return data || []
}

export async function grantAdminAccess(userId: string, role: 'super_admin' | 'moderator' | 'support' = 'moderator'): Promise<boolean> {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('profiles')
    .update({
      is_admin: true,
      admin_role: role,
      permissions: getDefaultPermissions(role),
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)

  if (error) {
    console.error('Error granting admin access:', error)
    return false
  }

  return true
}

export async function revokeAdminAccess(userId: string): Promise<boolean> {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('profiles')
    .update({
      is_admin: false,
      admin_role: null,
      permissions: [],
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)

  if (error) {
    console.error('Error revoking admin access:', error)
    return false
  }

  return true
}

function getDefaultPermissions(role: string): string[] {
  const permissions: { [key: string]: string[] } = {
    super_admin: ['all'],
    moderator: [
      'manage_users',
      'view_reports',
      'manage_content',
      'view_analytics',
      'manage_markets'
    ],
    support: [
      'view_reports',
      'manage_support_tickets'
    ]
  }

  return permissions[role] || []
}

export function hasPermission(profile: AdminProfile | null, permission: string): boolean {
  if (!profile) return false
  if (!profile.is_admin) return false
  if (profile.permissions?.includes('all')) return true
  return profile.permissions?.includes(permission) || false
}
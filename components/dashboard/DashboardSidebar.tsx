'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAdmin } from '@/hooks/useAdmin'
import { 
  FiHome, 
  FiTrendingUp, 
  FiDollarSign, 
  FiUsers, 
  FiAward, 
  FiSettings,
  FiChevronLeft,
  FiChevronRight,
  FiShield
} from 'react-icons/fi'

const baseNavigation = [
  { name: 'Overview', href: '/dashboard', icon: FiHome },
  { name: 'Markets', href: '/dashboard/markets', icon: FiTrendingUp },
  { name: 'Portfolio', href: '/dashboard/portfolio', icon: FiDollarSign },
  { name: 'Leaderboard', href: '/dashboard/leaderboard', icon: FiAward },
  { name: 'Community', href: '/dashboard/community', icon: FiUsers },
  { name: 'Settings', href: '/dashboard/settings', icon: FiSettings },
]

interface DashboardSidebarProps {
  isMobileOpen?: boolean
  onMobileClose?: () => void
}

export default function DashboardSidebar({ 
  isMobileOpen = false, 
  onMobileClose 
}: DashboardSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()
  const { isAdmin } = useAdmin()

  // Add admin link if user is admin
  const navigation = isAdmin 
    ? [...baseNavigation, { name: 'Admin', href: '/dashboard/admin', icon: FiShield }]
    : baseNavigation

  // Close mobile menu when route changes
  useEffect(() => {
    if (onMobileClose && isMobileOpen) {
      onMobileClose()
    }
  }, [pathname])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isMobileOpen])

  return (
    <>
      {/* Mobile Overlay - Only show on mobile when menu is open */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:relative
          inset-y-0 left-0
          z-50
          bg-white border-r border-gray-200
          transition-transform duration-300 ease-in-out
          w-64
          ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 h-22">
            {!isCollapsed && (
              <h1 className="text-xl font-bold text-gray-900">FlexBet</h1>
            )}
            {/* Collapse button - desktop only */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`hidden lg:block p-2 rounded-lg hover:bg-gray-100 transition-colors ${
                isCollapsed ? 'mx-auto' : ''
              }`}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? <FiChevronRight size={20} /> : <FiChevronLeft size={20} />}
            </button>
            
            {/* Mobile close button */}
            <button
              onClick={onMobileClose}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Close menu"
            >
              <FiChevronLeft size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              const isAdminItem = item.name === 'Admin'
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center rounded-lg px-3 py-3 text-sm font-medium 
                    transition-all duration-200 ease-in-out relative
                    ${isActive
                      ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    } 
                    ${isCollapsed ? 'lg:justify-center lg:px-2' : ''}
                    ${isAdminItem ? 'border-l-2 border-l-purple-500' : ''}
                  `}
                  onClick={() => {
                    // Close mobile menu when clicking a link
                    if (onMobileClose && isMobileOpen) {
                      onMobileClose()
                    }
                  }}
                >
                  <Icon 
                    size={20} 
                    className={`flex-shrink-0 ${isCollapsed ? 'lg:mr-0' : 'mr-3'} ${
                      isAdminItem ? 'text-purple-600' : ''
                    }`} 
                  />
                  <span className={isCollapsed ? 'lg:hidden' : ''}>
                    {item.name}
                  </span>
                  
                  {/* Admin badge for non-collapsed state */}
                  {isAdminItem && !isCollapsed && (
                    <span className="ml-auto bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full font-medium">
                      Admin
                    </span>
                  )}
                  
                  {/* Admin dot indicator for collapsed state */}
                  {isAdminItem && isCollapsed && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-purple-500 rounded-full lg:block hidden"></div>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className={`p-4 border-t border-gray-200 ${isCollapsed ? 'lg:hidden' : ''}`}>
            <div className="text-xs text-gray-500 text-center lg:text-left">
              © 2025 FlexBet
            </div>
            {isAdmin && !isCollapsed && (
              <div className="mt-2 flex items-center space-x-2 text-xs">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-green-600 font-medium">Admin Access</span>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
'use client'

import { useState } from 'react'
import { FiBarChart2, FiX, FiPlusCircle, FiFileText, FiUsers, FiMenu } from 'react-icons/fi'
import AdminStats from './AdminStats'
import CloseMarketForm from './CloseMarketForm'
import CreateMarketForm from './CreateMarketForm'
import ReportsAnalytics from './ReportsAnalytics'
import UserManagement from './UserManagement'

interface AdminTabsProps {
  markets: any[]
  users: any[]
  stats: any
  userId: string
}

type TabId = 'stats' | 'close-market' | 'create-market' | 'reports' | 'users'

export default function AdminTabs({ markets: initialMarkets, users, stats, userId }: AdminTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('stats')
  const [markets, setMarkets] = useState(initialMarkets)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const tabs = [
    { id: 'stats' as TabId, name: 'Overview', icon: FiBarChart2 },
    { id: 'create-market' as TabId, name: 'Create Market', icon: FiPlusCircle },
    { id: 'close-market' as TabId, name: 'Settle Markets', icon: FiX },
    { id: 'reports' as TabId, name: 'Reports', icon: FiFileText },
    { id: 'users' as TabId, name: 'Users', icon: FiUsers }
  ]

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId)
    setIsMobileMenuOpen(false) // Close mobile menu after selection
  }

  const activeTabData = tabs.find(tab => tab.id === activeTab)

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Tabs Navigation */}
      <div className="bg-white rounded-lg border border-gray-200">
        {/* Mobile Dropdown */}
        <div className="lg:hidden border-b border-gray-200">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="w-full flex items-center justify-between px-4 py-4 text-left"
          >
            <div className="flex items-center space-x-2">
              {activeTabData && (
                <>
                  <activeTabData.icon size={18} className="text-blue-600" />
                  <span className="font-medium text-gray-900">{activeTabData.name}</span>
                </>
              )}
            </div>
            <FiMenu 
              className={`text-gray-400 transition-transform ${isMobileMenuOpen ? 'rotate-90' : ''}`} 
              size={20} 
            />
          </button>
          
          {/* Mobile Menu Dropdown */}
          {isMobileMenuOpen && (
            <div className="border-t border-gray-200 bg-gray-50">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="font-medium">{tab.name}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Desktop Horizontal Tabs */}
        <div className="hidden lg:block border-b border-gray-200">
          <nav className="flex space-x-8 px-6 overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon size={18} />
                  <span>{tab.name}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-4 md:p-6">
          {activeTab === 'stats' && <AdminStats stats={stats} />}
          {activeTab === 'close-market' && <CloseMarketForm markets={markets} setMarkets={setMarkets} />}
          {activeTab === 'create-market' && <CreateMarketForm />}
          {activeTab === 'reports' && <ReportsAnalytics />}
          {activeTab === 'users' && <UserManagement users={users} />}
        </div>
      </div>

      {/* Mobile Tab Indicator (optional - shows at bottom) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
        <div className="flex justify-around">
          {tabs.slice(0, 4).map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-1 flex flex-col items-center py-3 transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon size={20} />
                <span className="text-xs mt-1 font-medium">{tab.name.split(' ')[0]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Add bottom padding to prevent content from being hidden by mobile nav */}
      <div className="lg:hidden h-16"></div>
    </div>
  )
}
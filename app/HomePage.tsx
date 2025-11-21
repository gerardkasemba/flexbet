'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import AuthModal from '@/app/auth/components/AuthModal'
import { 
  FiTrendingUp, 
  FiDollarSign, 
  FiClock, 
  FiShield, 
  FiZap, 
  FiUsers,
  FiBarChart2,
  FiCheckCircle,
  FiArrowRight
} from 'react-icons/fi'
import Link from 'next/link'

interface HomePageProps {
  redirectedFrom?: string | null
}

export default function HomePage({ redirectedFrom }: HomePageProps) {
  const { user, isLoading } = useAuth()
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('hero')

  useEffect(() => {
    if (redirectedFrom && !user && !isLoading) {
      setIsAuthModalOpen(true)
    }
  }, [redirectedFrom, user, isLoading])

  // Track active section for nav highlighting
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['hero', 'features', 'how-it-works', 'stats']
      const scrollPosition = window.scrollY + 100

      for (const section of sections) {
        const element = document.getElementById(section)
        if (element) {
          const { offsetTop, offsetHeight } = element
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section)
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Smooth scroll to section
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      const offsetTop = element.offsetTop - 64 // Account for fixed nav height
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth'
      })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  const navLinks = [
    { id: 'features', label: 'Features' },
    { id: 'how-it-works', label: 'How It Works' },
    { id: 'stats', label: 'Stats' }
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm shadow-sm border-b z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-0 lg:px-0">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center">
                <FiTrendingUp className="text-white" size={20} />
              </div>
              <h1 className="text-xl font-bold text-blue-700">
                QuadraTrade
              </h1>
            </div>
            
            <div className="hidden md:flex items-center space-x-8">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => scrollToSection(link.id)}
                  className={`text-sm font-medium transition-colors relative pb-1 ${
                    activeSection === link.id
                      ? 'text-blue-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {link.label}
                  {activeSection === link.id && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-700 rounded-full" />
                  )}
                </button>
              ))}
            </div>
            
            {!user ? (
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="text-gray-700 hover:text-gray-900 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-700/30"
                >
                  Get Started
                </button>
              </div>
            ) : (
              <Link 
                href="/dashboard"
                className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-700/30"
              >
                Go to Dashboard
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div id="hero" className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center space-x-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6 animate-fade-in">
              <FiZap size={16} />
              <span>Trade Sports Outcomes in Real-Time</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight animate-slide-up">
              Trade Sports Like
              <span className="text-blue-700"> Stocks</span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed animate-slide-up-delay">
              Buy low, sell high on live sports events. Exit positions anytime, lock in profits, or cut losses early. 
              Experience prediction markets powered by AMM technology.
            </p>
            
            {!user && (
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-slide-up-delay-2">
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="w-full sm:w-auto bg-blue-700 hover:bg-blue-800 text-white px-8 py-4 rounded-xl font-semibold transition-all shadow-xl shadow-blue-700/30 flex items-center justify-center group"
                >
                  Start Trading Free
                  <FiArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                </button>
                <button className="w-full sm:w-auto border-2 border-gray-300 hover:border-gray-400 bg-white text-gray-700 px-8 py-4 rounded-xl font-semibold transition-colors">
                  Watch Demo
                </button>
              </div>
            )}

            {/* Live Stats Bar */}
            <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 animate-fade-in-delay">
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
                <div className="text-3xl font-bold text-gray-900">$2.5M+</div>
                <div className="text-sm text-gray-600 mt-1">Trading Volume</div>
              </div>
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
                <div className="text-3xl font-bold text-gray-900">10K+</div>
                <div className="text-sm text-gray-600 mt-1">Active Traders</div>
              </div>
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-lg hover:shadow-xl transition-shadow">
                <div className="text-3xl font-bold text-gray-900">500+</div>
                <div className="text-sm text-gray-600 mt-1">Markets Settled</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section - Regular */}
      <div id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why FlexBet?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              The most advanced prediction market platform built for serious traders
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: FiTrendingUp,
                title: 'Real-Time Trading',
                description: 'Buy and sell positions as odds change during live matches. No need to wait until the end.',
                color: 'bg-blue-100 text-blue-700'
              },
              {
                icon: FiDollarSign,
                title: 'Exit Anytime',
                description: 'Lock in profits early or cut losses before the match ends. Full control over your positions.',
                color: 'bg-green-100 text-green-700'
              },
              {
                icon: FiClock,
                title: 'Instant Settlement',
                description: 'Get paid immediately when markets settle. No waiting days for withdrawals.',
                color: 'bg-purple-100 text-purple-700'
              },
              {
                icon: FiShield,
                title: 'Secure & Fair',
                description: 'Built on transparent AMM technology. Every trade is verifiable and secure.',
                color: 'bg-orange-100 text-orange-700'
              },
              {
                icon: FiBarChart2,
                title: 'Advanced Analytics',
                description: 'Track your performance with detailed P&L charts, win rates, and portfolio insights.',
                color: 'bg-pink-100 text-pink-700'
              },
              {
                icon: FiUsers,
                title: 'Order Book + AMM',
                description: 'Hybrid model combines peer-to-peer orders with automated market making for best prices.',
                color: 'bg-indigo-100 text-indigo-700'
              }
            ].map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-8 border border-gray-200 hover:border-blue-700 hover:shadow-xl transition-all group"
              >
                <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <feature.icon size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50 scroll-mt-16">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Start trading in three simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Choose a Market',
                description: 'Browse upcoming matches and pick outcomes you want to trade on.',
                icon: FiBarChart2
              },
              {
                step: '02',
                title: 'Buy Shares',
                description: 'Purchase shares at current market prices. Price goes up = more people agree with you.',
                icon: FiDollarSign
              },
              {
                step: '03',
                title: 'Sell or Hold',
                description: 'Cash out anytime for profit/loss, or hold until match ends. Winners get $1 per share.',
                icon: FiTrendingUp
              }
            ].map((step, index) => (
              <div key={index} className="relative">
                {index < 2 && (
                  <div className="hidden md:block absolute top-16 left-full w-full h-0.5 bg-blue-700 transform -translate-x-1/2 z-0" />
                )}
                <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg relative z-10 hover:shadow-xl transition-shadow">
                  <div className="w-16 h-16 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold text-2xl mb-6">
                    {step.step}
                  </div>
                  <step.icon className="text-blue-700 mb-4" size={32} />
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{step.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Social Proof */}
      <div id="stats" className="py-20 px-4 sm:px-6 lg:px-8 bg-blue-700 scroll-mt-16">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Trusted by Thousands of Traders
          </h2>
          <p className="text-xl text-blue-100 mb-12 max-w-2xl mx-auto">
            Join the fastest-growing sports prediction market in South Africa
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { value: '$2.5M+', label: 'Trading Volume' },
              { value: '10K+', label: 'Active Users' },
              { value: '500+', label: 'Markets Settled' },
              { value: '24/7', label: 'Trading Available' }
            ].map((stat, index) => (
              <div key={index} className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-all">
                <div className="text-4xl font-bold text-white mb-2">{stat.value}</div>
                <div className="text-blue-100">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Ready to Start Trading?
          </h2>
          <p className="text-xl text-gray-600 mb-10">
            Join thousands of traders making profits on live sports events
          </p>
          
          {!user && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="bg-blue-700 hover:bg-blue-800 text-white px-8 py-4 rounded-xl font-semibold transition-all shadow-xl shadow-blue-700/30 flex items-center justify-center group"
              >
                Create Free Account
                <FiArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-sm text-gray-600">
            <div className="flex items-center">
              <FiCheckCircle className="text-green-500 mr-2" />
              <span>Free to join</span>
            </div>
            <div className="flex items-center">
              <FiCheckCircle className="text-green-500 mr-2" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center">
              <FiCheckCircle className="text-green-500 mr-2" />
              <span>Start with demo money</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-white font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">How It Works</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Resources</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Trading Guide</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API Docs</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Cookies</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-6 h-6 bg-blue-700 rounded"></div>
              <span className="text-white font-bold">FlexBet</span>
            </div>
            <p className="text-sm">© 2024 FlexBet. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fadeIn 0.6s ease-out;
        }

        .animate-fade-in-delay {
          animation: fadeIn 0.8s ease-out 0.4s both;
        }

        .animate-slide-up {
          animation: slideUp 0.6s ease-out;
        }

        .animate-slide-up-delay {
          animation: slideUp 0.6s ease-out 0.2s both;
        }

        .animate-slide-up-delay-2 {
          animation: slideUp 0.6s ease-out 0.4s both;
        }

        .scroll-mt-16 {
          scroll-margin-top: 4rem;
        }

        html {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  )
}
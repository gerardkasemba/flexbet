'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import LoginForm from './LoginForm'
import RegisterForm from './RegisterForm'
import ForgotPasswordForm from './ForgotPasswordForm'
import { IoClose } from 'react-icons/io5'

type AuthModalProps = {
  isOpen: boolean
  onClose: () => void
  initialView?: 'login' | 'register' | 'forgot-password'
}

export default function AuthModal({ isOpen, onClose, initialView = 'login' }: AuthModalProps) {
  const [currentView, setCurrentView] = useState(initialView)
  const modalRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  // Update currentView when initialView changes
  useEffect(() => {
    setCurrentView(initialView)
  }, [initialView])

  if (!isOpen) return null

  const renderForm = () => {
    switch (currentView) {
      case 'login':
        return (
          <LoginForm 
            onSwitchToRegister={() => setCurrentView('register')}
            onSwitchToForgotPassword={() => setCurrentView('forgot-password')}
            onSuccess={onClose}
          />
        )
      case 'register':
        return (
          <RegisterForm 
            onSwitchToLogin={() => setCurrentView('login')}
            onSuccess={onClose}
          />
        )
      case 'forgot-password':
        return (
          <ForgotPasswordForm 
            onSwitchToLogin={() => setCurrentView('login')}
            onSuccess={onClose}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          ref={modalRef}
          className="bg-white rounded-2xl shadow-xl w-full max-w-md relative my-8 max-h-[calc(100vh-4rem)] flex flex-col"
        >
          {/* Close button - sticky at top */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors z-10 bg-white/80 backdrop-blur-sm rounded-full p-1 shadow-sm"
            aria-label="Close modal"
          >
            <IoClose size={24} />
          </button>
          
          {/* Scrollable content */}
          <div className="overflow-y-auto">
            {renderForm()}
          </div>
        </div>
      </div>
    </div>
  )
}
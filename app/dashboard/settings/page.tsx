'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { 
  FiSettings, 
  FiShield, 
  FiCreditCard, 
  FiUser, 
  FiBell, 
  FiGlobe, 
  FiLock, 
  FiEye, 
  FiEyeOff,
  FiSave,
  FiCheck,
  FiX,
  FiPlus,
  FiTrash2
} from 'react-icons/fi'

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const supabase = createClient()

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: FiUser },
    { id: 'security', label: 'Security', icon: FiShield },
    { id: 'payment', label: 'Payment Methods', icon: FiCreditCard },
    { id: 'notifications', label: 'Notifications', icon: FiBell },
    { id: 'preferences', label: 'Preferences', icon: FiGlobe }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-0 sm:px-0 lg:px-0 py-0">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">Manage your account settings and preferences</p>
        </div>

        {/* Success/Error Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <FiCheck className="mr-3 flex-shrink-0" size={20} />
            ) : (
              <FiX className="mr-3 flex-shrink-0" size={20} />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden sticky top-6">
              <nav className="p-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                        activeTab === tab.id
                          ? 'bg-blue-50 text-blue-700 shadow-sm'
                          : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <Icon size={20} />
                      <span>{tab.label}</span>
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              {activeTab === 'profile' && <ProfileSettings profile={profile} showMessage={showMessage} refreshProfile={refreshProfile} />}
              {activeTab === 'security' && <SecuritySettings user={user} showMessage={showMessage} />}
              {activeTab === 'payment' && <PaymentSettings profile={profile} showMessage={showMessage} refreshProfile={refreshProfile} />}
              {activeTab === 'notifications' && <NotificationSettings profile={profile} showMessage={showMessage} refreshProfile={refreshProfile} />}
              {activeTab === 'preferences' && <PreferenceSettings profile={profile} showMessage={showMessage} refreshProfile={refreshProfile} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Profile Settings Component
function ProfileSettings({ profile, showMessage, refreshProfile }: any) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    username: profile?.username || '',
    full_name: profile?.full_name || '',
    phone_number: profile?.phone_number || '',
    date_of_birth: profile?.date_of_birth || '',
    country: profile?.country || 'ZA',
    city: profile?.city || '',
    bio: profile?.bio || ''
  })
  const supabase = createClient()

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: formData.username,
          full_name: formData.full_name,
          phone_number: formData.phone_number,
          date_of_birth: formData.date_of_birth,
          country: formData.country,
          city: formData.city,
          bio: formData.bio,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile?.id)

      if (error) throw error

      await refreshProfile()
      setIsEditing(false)
      showMessage('success', 'Profile updated successfully!')
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Profile Information</h2>
          <p className="text-gray-600 mt-1">Update your personal details and information</p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            Edit Profile
          </button>
        )}
      </div>
      
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              disabled={!isEditing}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 transition-colors"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              disabled={!isEditing}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={profile?.email || ''}
              disabled
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
            <input
              type="tel"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              disabled={!isEditing}
              placeholder="+27 XX XXX XXXX"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
            <input
              type="date"
              value={formData.date_of_birth}
              onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              disabled={!isEditing}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 transition-colors"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
            <select
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              disabled={!isEditing}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 transition-colors"
            >
              <option value="ZA">South Africa</option>
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
              <option value="CD">Congo (DRC)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            disabled={!isEditing}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
          <textarea
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            disabled={!isEditing}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 transition-colors"
            placeholder="Tell us about yourself..."
          />
        </div>

        {isEditing && (
          <div className="flex items-center space-x-3 pt-6 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <FiSave className="mr-2" size={16} />
                  Save Changes
                </>
              )}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Security Settings Component
function SecuritySettings({ user, showMessage }: any) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const supabase = createClient()

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      showMessage('error', "New passwords don't match")
      return
    }

    if (newPassword.length < 8) {
      showMessage('error', 'Password must be at least 8 characters')
      return
    }
    
    setIsChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      showMessage('success', 'Password changed successfully!')
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to change password')
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Security Settings</h2>
        <p className="text-gray-600 mt-1">Manage your password and security preferences</p>
      </div>
      
      <div className="space-y-6">
        {/* Change Password */}
        <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
              <FiLock className="text-blue-600" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>
              <p className="text-sm text-gray-600">Update your password regularly to keep your account secure</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-12 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showCurrentPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-12 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showNewPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-12 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirmPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
            </div>

            <button
              onClick={handlePasswordChange}
              disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="w-full md:w-auto px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {isChangingPassword ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Changing...
                </>
              ) : (
                <>
                  <FiLock className="mr-2" size={16} />
                  Change Password
                </>
              )}
            </button>
          </div>
        </div>

        {/* Two-Factor Authentication */}
        <div className="border border-gray-200 rounded-xl p-6">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
              <FiShield className="text-purple-600" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Two-Factor Authentication</h3>
              <p className="text-sm text-gray-600">Add an extra layer of security to your account</p>
            </div>
          </div>
          <button className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
            Enable 2FA (Coming Soon)
          </button>
        </div>
      </div>
    </div>
  )
}

// Payment Settings Component
function PaymentSettings({ profile, showMessage, refreshProfile }: any) {
  const [paymentMethods, setPaymentMethods] = useState<any[]>(
    profile?.payment_methods ? (typeof profile.payment_methods === 'string' ? JSON.parse(profile.payment_methods) : profile.payment_methods) : []
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isAddingMethod, setIsAddingMethod] = useState(false)
  const [newPayment, setNewPayment] = useState({
    type: 'bank_account',
    account_holder: '',
    account_number: '',
    bank_name: '',
    branch_code: ''
  })
  const supabase = createClient()

  const handleAddPaymentMethod = async () => {
    if (!newPayment.account_holder || !newPayment.account_number || !newPayment.bank_name) {
      showMessage('error', 'Please fill in all required fields')
      return
    }

    setIsSaving(true)
    try {
      const updatedMethods = [
        ...paymentMethods,
        {
          id: Date.now().toString(),
          ...newPayment,
          created_at: new Date().toISOString(),
          is_default: paymentMethods.length === 0
        }
      ]

      const { error } = await supabase
        .from('profiles')
        .update({
          payment_methods: updatedMethods,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile?.id)

      if (error) throw error

      setPaymentMethods(updatedMethods)
      setNewPayment({
        type: 'bank_account',
        account_holder: '',
        account_number: '',
        bank_name: '',
        branch_code: ''
      })
      setIsAddingMethod(false)
      await refreshProfile()
      showMessage('success', 'Payment method added successfully!')
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to add payment method')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemovePaymentMethod = async (id: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) return

    setIsSaving(true)
    try {
      const updatedMethods = paymentMethods.filter(m => m.id !== id)

      const { error } = await supabase
        .from('profiles')
        .update({
          payment_methods: updatedMethods,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile?.id)

      if (error) throw error

      setPaymentMethods(updatedMethods)
      await refreshProfile()
      showMessage('success', 'Payment method removed successfully!')
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to remove payment method')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Payment Methods</h2>
        <p className="text-gray-600 mt-1">Manage your payment methods for withdrawals</p>
      </div>
      
      <div className="space-y-6">
        {/* Current Balance */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium mb-1">Available Balance</p>
              <p className="text-4xl font-bold">${profile?.balance?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <FiCreditCard size={32} />
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Saved Payment Methods</h3>
            <button
              onClick={() => setIsAddingMethod(true)}
              className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center"
            >
              <FiPlus className="mr-2" size={16} />
              Add Method
            </button>
          </div>

          {paymentMethods.length === 0 ? (
            <div className="text-center py-8">
              <FiCreditCard className="mx-auto text-gray-400 mb-3" size={48} />
              <p className="text-gray-600 font-medium">No payment methods added</p>
              <p className="text-sm text-gray-500 mt-1">Add a payment method to withdraw funds</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                        <FiCreditCard className="text-blue-600" size={24} />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="font-semibold text-gray-900">{method.bank_name}</p>
                          {method.is_default && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{method.account_holder}</p>
                        <p className="text-sm text-gray-500">•••• {method.account_number.slice(-4)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemovePaymentMethod(method.id)}
                      className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <FiTrash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isAddingMethod && (
            <div className="mt-6 p-6 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50">
              <h4 className="text-md font-semibold text-gray-900 mb-4">Add New Payment Method</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Holder Name</label>
                  <input
                    type="text"
                    value={newPayment.account_holder}
                    onChange={(e) => setNewPayment({ ...newPayment, account_holder: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
                  <input
                    type="text"
                    value={newPayment.bank_name}
                    onChange={(e) => setNewPayment({ ...newPayment, bank_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Standard Bank"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
                  <input
                    type="text"
                    value={newPayment.account_number}
                    onChange={(e) => setNewPayment({ ...newPayment, account_number: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="1234567890"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Branch Code</label>
                  <input
                    type="text"
                    value={newPayment.branch_code}
                    onChange={(e) => setNewPayment({ ...newPayment, branch_code: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="051001"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-3 mt-6">
                <button
                  onClick={handleAddPaymentMethod}
                  disabled={isSaving}
                  className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Adding...
                    </>
                  ) : (
                    <>
                      <FiSave className="mr-2" size={16} />
                      Add Payment Method
                    </>
                  )}
                </button>
                <button
                  onClick={() => setIsAddingMethod(false)}
                  className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Notification Settings Component
function NotificationSettings({ profile, showMessage, refreshProfile }: any) {
  const [isSaving, setIsSaving] = useState(false)
  const [notifications, setNotifications] = useState({
    email_notifications: profile?.email_notifications ?? true,
    push_notifications: profile?.push_notifications ?? true,
    sms_notifications: profile?.sms_notifications ?? false,
    marketing_emails: profile?.marketing_emails ?? false
  })
  const supabase = createClient()

  const handleSaveNotifications = async () => {
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...notifications,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile?.id)

      if (error) throw error

      await refreshProfile()
      showMessage('success', 'Notification preferences saved!')
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to save preferences')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Notification Preferences</h2>
        <p className="text-gray-600 mt-1">Choose how you want to be notified</p>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between py-4 border-b border-gray-200">
          <div>
            <p className="text-base font-medium text-gray-900">Email Notifications</p>
            <p className="text-sm text-gray-600 mt-0.5">Receive updates and alerts via email</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={notifications.email_notifications}
              onChange={(e) => setNotifications({ ...notifications, email_notifications: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between py-4 border-b border-gray-200">
          <div>
            <p className="text-base font-medium text-gray-900">Push Notifications</p>
            <p className="text-sm text-gray-600 mt-0.5">Receive notifications in your browser</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={notifications.push_notifications}
              onChange={(e) => setNotifications({ ...notifications, push_notifications: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between py-4 border-b border-gray-200">
          <div>
            <p className="text-base font-medium text-gray-900">SMS Notifications</p>
            <p className="text-sm text-gray-600 mt-0.5">Get important alerts via text message</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={notifications.sms_notifications}
              onChange={(e) => setNotifications({ ...notifications, sms_notifications: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between py-4">
          <div>
            <p className="text-base font-medium text-gray-900">Marketing Emails</p>
            <p className="text-sm text-gray-600 mt-0.5">Receive promotional offers and updates</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={notifications.marketing_emails}
              onChange={(e) => setNotifications({ ...notifications, marketing_emails: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="pt-6 border-t border-gray-200">
          <button
            onClick={handleSaveNotifications}
            disabled={isSaving}
            className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <FiSave className="mr-2" size={16} />
                Save Preferences
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// Preference Settings Component
function PreferenceSettings({ profile, showMessage, refreshProfile }: any) {
  const [isSaving, setIsSaving] = useState(false)
  const [preferences, setPreferences] = useState({
    preferred_language: profile?.preferred_language || 'en',
    theme: profile?.theme || 'light',
    is_public: profile?.is_public ?? true,
    allow_friend_requests: profile?.allow_friend_requests ?? true,
    show_trade_history: profile?.show_trade_history ?? false
  })
  const supabase = createClient()

  const handleSavePreferences = async () => {
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...preferences,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile?.id)

      if (error) throw error

      await refreshProfile()
      showMessage('success', 'Preferences saved successfully!')
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to save preferences')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Preferences</h2>
        <p className="text-gray-600 mt-1">Customize your experience</p>
      </div>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
          <select
            value={preferences.preferred_language}
            onChange={(e) => setPreferences({ ...preferences, preferred_language: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            <option value="en">English</option>
            <option value="af">Afrikaans</option>
            <option value="zu">Zulu</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
          <select
            value={preferences.theme}
            onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto</option>
          </select>
        </div>

        <div className="pt-4 space-y-4 border-t border-gray-200">
          <div className="flex items-center justify-between py-4 border-b border-gray-200">
            <div>
              <p className="text-base font-medium text-gray-900">Public Profile</p>
              <p className="text-sm text-gray-600 mt-0.5">Allow others to view your profile</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.is_public}
                onChange={(e) => setPreferences({ ...preferences, is_public: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-4 border-b border-gray-200">
            <div>
              <p className="text-base font-medium text-gray-900">Friend Requests</p>
              <p className="text-sm text-gray-600 mt-0.5">Allow others to send you friend requests</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.allow_friend_requests}
                onChange={(e) => setPreferences({ ...preferences, allow_friend_requests: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-4">
            <div>
              <p className="text-base font-medium text-gray-900">Show Trade History</p>
              <p className="text-sm text-gray-600 mt-0.5">Display your trading history publicly</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.show_trade_history}
                onChange={(e) => setPreferences({ ...preferences, show_trade_history: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-200">
          <button
            onClick={handleSavePreferences}
            disabled={isSaving}
            className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <FiSave className="mr-2" size={16} />
                Save Preferences
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
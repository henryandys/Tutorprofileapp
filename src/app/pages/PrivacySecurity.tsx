import { useState } from "react";
import { Navbar } from "../components/Navbar";
import { Shield, Lock, EyeOff, Save, ChevronLeft, Eye, EyeClosed } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

export function PrivacySecurity() {
  const { user } = useAuth()
  const navigate  = useNavigate()

  // Password change state
  const [newPassword, setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew]             = useState(false)
  const [showConfirm, setShowConfirm]     = useState(false)
  const [savingPw, setSavingPw]           = useState(false)

  // Account disable state
  const [disabling, setDisabling] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      toast.error('Failed to update password: ' + error.message)
    } else {
      toast.success('Password updated successfully.')
      setNewPassword('')
      setConfirmPassword('')
    }
    setSavingPw(false)
  }

  async function handleDisableAccount() {
    if (!user) return
    setDisabling(true)
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('id', user.id)
    if (error) {
      toast.error('Failed to disable account: ' + error.message)
    } else {
      toast.success('Your account has been disabled and is no longer visible to others.')
      navigate('/profile')
    }
    setDisabling(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 md:px-8 py-10">

        <div className="mb-8 flex items-center gap-4">
          <Link
            to="/profile"
            className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Profile
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Privacy & Security</h1>
            <p className="text-sm text-gray-500 font-medium">Manage your password and account visibility.</p>
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden mb-6">
          <div className="px-8 py-6 border-b border-gray-100 flex items-center gap-3">
            <Lock className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-black text-gray-900">Change Password</h2>
          </div>

          <form onSubmit={handlePasswordChange} className="px-8 py-6 space-y-5">
            <p className="text-sm text-gray-500 font-medium">
              You are already signed in, so no current password is required.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full h-12 px-4 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(v => !v)}
                  className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600"
                >
                  {showNew ? <EyeClosed className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full h-12 px-4 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 bg-gray-50"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? <EyeClosed className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500 font-bold px-1">Passwords do not match.</p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingPw || !newPassword || newPassword !== confirmPassword}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {savingPw ? 'Saving…' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>

        {/* Disable Account */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100 flex items-center gap-3">
            <EyeOff className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-black text-gray-900">Account Visibility</h2>
          </div>

          <div className="px-8 py-6 space-y-5">
            <p className="text-sm text-gray-600 font-medium leading-relaxed">
              Disabling your account hides your profile from search results and other users. You can
              re-enable it at any time by contacting support or signing back in.
            </p>

            {!confirmDisable ? (
              <button
                onClick={() => setConfirmDisable(true)}
                className="px-6 py-2.5 border-2 border-red-200 text-red-600 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors"
              >
                Disable My Account
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-4">
                <p className="text-sm font-bold text-red-700">
                  Are you sure? Your profile will be hidden immediately.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDisableAccount}
                    disabled={disabling}
                    className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-60"
                  >
                    {disabling ? 'Disabling…' : 'Yes, disable my account'}
                  </button>
                  <button
                    onClick={() => setConfirmDisable(false)}
                    className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  )
}

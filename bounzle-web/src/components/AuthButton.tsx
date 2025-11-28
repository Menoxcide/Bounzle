'use client'

import { useSupabase } from '@/providers/SupabaseProvider'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export default function AuthButton() {
  const { supabase, session } = useSupabase()
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      console.error('Error logging in:', error)
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error logging out:', error)
    }
    setLoading(false)
  }

  return (
    <Button
      onClick={session ? handleLogout : handleLogin}
      disabled={loading}
      variant="outline"
    >
      {loading ? 'Loading...' : session ? 'Sign Out' : 'Sign In'}
    </Button>
  )
}
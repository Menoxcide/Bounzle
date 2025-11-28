'use client'

import { useSupabase } from '@/providers/SupabaseProvider'
import { useEffect, useState } from 'react'

export const useSupabaseAuth = () => {
  const { supabase, session } = useSupabase()
  const [user, setUser] = useState(session?.user || null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      if (session?.user) {
        setUser(session.user)
      } else {
        setUser(null)
      }
      setLoading(false)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [session, supabase])

  return { user, session, loading }
}
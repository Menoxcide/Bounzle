import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      get(name: string) {
        const cookieStore = cookies()
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        const cookieStore = cookies()
        cookieStore.set(name, value, options)
      },
      remove(name: string, options: any) {
        const cookieStore = cookies()
        cookieStore.delete(name, options)
      },
    },
  }
)
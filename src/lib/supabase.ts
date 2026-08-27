import { createClient } from '@supabase/supabase-js'

const defaultSupabaseUrl = 'https://bjbyfziutvcasozppycg.supabase.co'
const defaultPublishableKey = 'sb_publishable_ynIa554QuoQ-vI-DpN13NQ_1X6-JVhI'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || defaultSupabaseUrl
const supabasePublishableKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  defaultPublishableKey

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

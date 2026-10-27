import { createTransport } from './supabase-core'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const isLive = Boolean(url && key)
export const { signIn, signOut, api } = createTransport(url, key)

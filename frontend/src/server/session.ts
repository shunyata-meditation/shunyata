import '@tanstack/react-start/server-only'
import { useSession } from '@tanstack/react-start/server'
import { createApi } from './transport'
import type { Tokens } from './transport'

export function appSession() {
  const password = process.env.SESSION_SECRET
  if (!password || password.length < 32)
    throw new Error('Set SESSION_SECRET to at least 32 characters.')
  return useSession<Tokens & { timerScope: string }>({
    name: 'shunyata-session',
    password,
    sessionHeader: false,
    maxAge: 86400,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    },
  })
}
export function api() {
  return createApi(process.env.BACKEND_API_URL ?? 'http://127.0.0.1:8000/api')
}

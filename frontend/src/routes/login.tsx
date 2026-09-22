import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthForm } from '../components/auth-form'
export const Route = createFileRoute('/login')({
  beforeLoad: ({ context }) => {
    if (context.auth.authenticated) throw redirect({ to: '/' })
  },
  head: () => ({ meta: [{ title: 'Sign in — Shunyata' }] }),
  component: () => <AuthForm mode="login" />,
})

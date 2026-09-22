import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthForm } from '../components/auth-form'
export const Route = createFileRoute('/register')({
  beforeLoad: ({ context }) => {
    if (context.auth.authenticated) throw redirect({ to: '/' })
  },
  head: () => ({ meta: [{ title: 'Begin your journal | Shunyata' }] }),
  component: () => <AuthForm mode="register" />,
})

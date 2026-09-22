import { createFileRoute, redirect } from '@tanstack/react-router'
import { AccountEmailPage } from '../components/account-recovery'

export const Route = createFileRoute('/forgot-password')({
  beforeLoad: ({ context }) => {
    if (context.auth.authenticated) throw redirect({ to: '/profile' })
  },
  head: () => ({ meta: [{ title: 'Reset password | Shunyata' }] }),
  component: () => <AccountEmailPage mode="password-reset" />,
})

import { createFileRoute, redirect } from '@tanstack/react-router'
import { AccountEmailPage } from '../components/account-recovery'

export const Route = createFileRoute('/resend-verification')({
  beforeLoad: ({ context }) => {
    if (context.auth.authenticated) throw redirect({ to: '/profile' })
  },
  head: () => ({ meta: [{ title: 'Resend verification | Shunyata' }] }),
  component: () => <AccountEmailPage mode="verification" />,
})

import { createFileRoute } from '@tanstack/react-router'
import { TimerScreen } from '../../components/timer/timer-screen'
import { typesQuery } from '../../lib/queries'

export const Route = createFileRoute('/_authed/timer')({
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery(typesQuery())
  },
  head: () => ({ meta: [{ title: 'Meditation timer — Shunyata' }] }),
  component: TimerScreen,
})

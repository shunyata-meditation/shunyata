import { createFileRoute } from '@tanstack/react-router'
import { SessionPage } from '../../components/session-form'
import { typesQuery } from '../../lib/queries'
export const Route = createFileRoute('/_authed/sessions/new')({
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery(typesQuery())
  },
  head: () => ({ meta: [{ title: 'Log a session | Shunyata' }] }),
  component: () => <SessionPage />,
})

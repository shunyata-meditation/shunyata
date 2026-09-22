import { createFileRoute, notFound } from '@tanstack/react-router'
import { SessionPage } from '../../components/session-form'
import { sessionQuery, typesQuery } from '../../lib/queries'
export const Route = createFileRoute('/_authed/sessions/$sessionId/edit')({
  loader: async ({ context, params }) => {
    const id = Number(params.sessionId)
    if (!Number.isSafeInteger(id) || id <= 0) throw notFound()
    await Promise.all([
      context.queryClient.prefetchQuery(sessionQuery(id)),
      context.queryClient.prefetchQuery(typesQuery()),
    ])
  },
  head: () => ({ meta: [{ title: 'Edit your session — Shunyata' }] }),
  component: () => {
    const { sessionId } = Route.useParams()
    return <SessionPage id={Number(sessionId)} />
  },
})

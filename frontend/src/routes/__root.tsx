import {
  HeadContent,
  Link,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { getAuth } from '../server/functions'
import { ErrorNotice } from '../components/ui'
import appCss from '../styles.css?url'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    beforeLoad: async ({ context }) => {
      const auth = await getAuth()
      const previousScope = context.queryClient.getQueryData<string | null>([
        'authScope',
      ])
      if (previousScope !== undefined && previousScope !== auth.timerScope)
        context.queryClient.clear()
      context.queryClient.setQueryData(['authScope'], auth.timerScope)
      return { auth }
    },
    headers: () => ({
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'same-origin',
    }),
    head: () => ({
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { title: 'Shunyata | A space for your practice' },
        {
          name: 'description',
          content:
            'A quiet place to record your meditation practice, one moment at a time.',
        },
        { name: 'theme-color', content: '#f7f5ee' },
      ],
      links: [{ rel: 'stylesheet', href: appCss }],
    }),
    shellComponent: RootDocument,
    notFoundComponent: () => (
      <main className="standalone">
        <p className="eyebrow">A quiet detour</p>
        <h1>This page has drifted away.</h1>
        <Link to="/" className="button">
          Return to your journal
        </Link>
      </main>
    ),
    errorComponent: ({ error, reset }) => (
      <main className="standalone">
        <h1>A moment of interruption.</h1>
        <ErrorNotice error={error} retry={reset} />
      </main>
    ),
  },
)
function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

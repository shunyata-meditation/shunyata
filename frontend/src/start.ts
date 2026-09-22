import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'

const privateResponses = createMiddleware().server(async ({ next }) => {
  setResponseHeader('Cache-Control', 'private, no-store')
  return next()
})

export const startInstance = createStart(() => ({
  requestMiddleware: [
    privateResponses,
    createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' }),
  ],
}))

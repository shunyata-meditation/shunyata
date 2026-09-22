import { ZodError } from 'zod'
import { ApiError } from '../lib/contracts'
import type { ApiProblem, Result } from '../lib/contracts'

export interface Tokens {
  access: string
  refresh: string
}
export interface TokenSession {
  data: Partial<Tokens>
  update: (tokens: Partial<Tokens>) => Promise<unknown>
  clear: () => Promise<unknown>
}
export function normalizeProblem(status: number, body: unknown): ApiProblem {
  const fields: Record<string, string> = {}
  let message =
    status >= 500
      ? 'The journal is unavailable for a moment. Please try again.'
      : 'Please check the details and try again.'
  if (status === 404) message = 'This session could not be found.'
  if (body && typeof body === 'object' && status < 500) {
    for (const [key, value] of Object.entries(body)) {
      const text = Array.isArray(value)
        ? value.filter((item) => typeof item === 'string').join(' ')
        : typeof value === 'string'
          ? value
          : ''
      if (!text) continue
      if (['detail', 'error', 'non_field_errors'].includes(key)) message = text
      else fields[key] = text
    }
  }
  return { status, message, fields }
}
export async function resultOf<T>(
  action: () => Promise<T>,
): Promise<Result<T>> {
  try {
    return { ok: true, data: await action() }
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.problem }
    if (error instanceof ZodError) {
      const fields: Record<string, string> = {}
      for (const issue of error.issues)
        fields[String(issue.path[0] ?? 'form')] = issue.message
      return {
        ok: false,
        error: {
          status: 400,
          message: 'Please check the highlighted fields.',
          fields,
        },
      }
    }
    return {
      ok: false,
      error: {
        status: 503,
        message: 'We could not reach your journal. Please try again.',
        fields: {},
      },
    }
  }
}
export function createApi(baseUrl: string, fetcher: typeof fetch = fetch) {
  const base = baseUrl.replace(/\/$/, '')
  async function request<T>(
    path: string,
    options: RequestInit = {},
    access?: string,
  ): Promise<T> {
    const response = await fetcher(`${base}${path}`, {
      ...options,
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(access ? { Authorization: `Bearer ${access}` } : {}),
      },
    })
    const body: unknown =
      response.status === 204 ? null : await response.json().catch(() => null)
    if (!response.ok)
      throw new ApiError(normalizeProblem(response.status, body))
    return body as T
  }
  async function authenticated<T>(
    session: TokenSession,
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const expired = async (): Promise<never> => {
      await session.clear()
      throw new ApiError({
        status: 401,
        message: 'Your session has ended. Please sign in again.',
        fields: {},
      })
    }
    if (!session.data.refresh || !session.data.access) return expired()
    try {
      return await request<T>(path, options, session.data.access)
    } catch (error) {
      if (!(error instanceof ApiError) || error.problem.status !== 401)
        throw error
    }
    let tokens: { access: string; refresh?: string }
    try {
      tokens = await request('/auth/refresh/', {
        method: 'POST',
        body: JSON.stringify({ refresh: session.data.refresh }),
      })
    } catch (error) {
      if (
        error instanceof ApiError &&
        [400, 401].includes(error.problem.status)
      )
        return expired()
      throw error
    }
    await session.update({
      access: tokens.access,
      ...(tokens.refresh ? { refresh: tokens.refresh } : {}),
    })
    try {
      return await request<T>(path, options, tokens.access)
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 401)
        return expired()
      throw error
    }
  }
  return { request, authenticated }
}

import { describe, expect, it, vi } from 'vitest'
import { createApi, normalizeProblem, resultOf } from '../src/server/transport'
import type { TokenSession } from '../src/server/transport'

const response = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
function session(): TokenSession {
  return {
    data: { access: 'old-access', refresh: 'refresh' },
    update: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  }
}
describe('Django transport', () => {
  it('maps field errors and hides backend exception details', () => {
    expect(
      normalizeProblem(400, {
        username: ['Already in use.'],
        non_field_errors: ['Try another name.'],
      }),
    ).toEqual({
      status: 400,
      message: 'Try another name.',
      fields: { username: 'Already in use.' },
    })
    expect(
      normalizeProblem(500, { detail: 'database password secret' }).message,
    ).not.toContain('secret')
  })
  it('refreshes once, updates the cookie, and retries with the new access token', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(401, {}))
      .mockResolvedValueOnce(response(200, { access: 'new-access' }))
      .mockResolvedValueOnce(response(200, []))
    const state = session()
    expect(
      await createApi('http://api.test/api', fetcher).authenticated(
        state,
        '/meditations/sessions/',
      ),
    ).toEqual([])
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(fetcher.mock.calls[2][1]?.headers).toMatchObject({
      Authorization: 'Bearer new-access',
    })
    expect(state.update).toHaveBeenCalledWith({ access: 'new-access' })
    expect(state.clear).not.toHaveBeenCalled()
  })
  it.each([400, 401])(
    'clears authentication when refresh returns %s',
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(response(401, {}))
        .mockResolvedValueOnce(response(status, {}))
      const state = session()
      const result = await resultOf(() =>
        createApi('http://api.test', fetcher).authenticated(
          state,
          '/sessions/',
        ),
      )
      expect(result).toMatchObject({ ok: false, error: { status: 401 } })
      expect(state.clear).toHaveBeenCalledOnce()
    },
  )
  it('does not sign out a user when the refresh service is unavailable', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(401, {}))
      .mockResolvedValueOnce(response(503, {}))
    const state = session()
    expect(
      await resultOf(() =>
        createApi('http://api.test', fetcher).authenticated(
          state,
          '/sessions/',
        ),
      ),
    ).toMatchObject({ ok: false, error: { status: 503 } })
    expect(state.clear).not.toHaveBeenCalled()
  })
  it('stops after a second 401 and never retries a failed write on 500', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(401, {}))
      .mockResolvedValueOnce(response(200, { access: 'new' }))
      .mockResolvedValueOnce(response(401, {}))
    const state = session()
    await resultOf(() =>
      createApi('http://api.test', fetcher).authenticated(state, '/sessions/'),
    )
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(state.clear).toHaveBeenCalledOnce()
    const unavailable = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response(500, {}))
    await resultOf(() =>
      createApi('http://api.test', unavailable).authenticated(
        session(),
        '/sessions/',
        { method: 'POST', body: '{}' },
      ),
    )
    expect(unavailable).toHaveBeenCalledOnce()
  })
  it('rejects unauthenticated calls without reaching Django', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const state = session()
    state.data = {}
    expect(
      await resultOf(() =>
        createApi('http://api.test', fetcher).authenticated(
          state,
          '/sessions/',
        ),
      ),
    ).toMatchObject({ ok: false, error: { status: 401 } })
    expect(fetcher).not.toHaveBeenCalled()
  })
})

import { createServerFn } from '@tanstack/react-start'
import { appSession, api } from './session'
import { resultOf } from './transport'
import type { Tokens } from './transport'
import {
  accountEmailSchema,
  idSchema,
  loginSchema,
  passwordChangeSchema,
  passwordPairSchema,
  practiceGoalSchema,
  registerSchema,
  resetLinkSchema,
  sessionSchema,
  tokenSchema,
} from '../lib/validation'
import type {
  AccountEmailInput,
  LoginInput,
  RegisterInput,
  SessionInput,
  MeditationSession,
  MeditationType,
  PasswordChangeInput,
  PasswordPairInput,
  PracticeGoal,
  PracticeGoalInput,
  Profile,
  ResetLinkInput,
} from '../lib/contracts'
import { sessionPayload } from '../lib/session-values'
import { ApiError } from '../lib/contracts'

export const getAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await appSession()
  const authenticated = Boolean(session.data.access && session.data.refresh)
  let timerScope = session.data.timerScope
  if (authenticated && !timerScope) {
    timerScope = crypto.randomUUID()
    await session.update({ timerScope })
  }
  return {
    authenticated,
    timerScope: authenticated ? (timerScope ?? null) : null,
  }
})
export const login = createServerFn({ method: 'POST' })
  .validator((data: LoginInput) => data)
  .handler(({ data }) =>
    resultOf(async () => {
      const tokens = await api().request<Tokens>('/auth/login/', {
        method: 'POST',
        body: JSON.stringify(loginSchema.parse(data)),
      })
      const session = await appSession()
      await session.clear()
      await session.update({ ...tokens, timerScope: crypto.randomUUID() })
      return null
    }),
  )
export const register = createServerFn({ method: 'POST' })
  .validator((data: RegisterInput) => data)
  .handler(({ data }) =>
    resultOf(async () => {
      return api().request<{ message: string }>('/auth/register/', {
        method: 'POST',
        body: JSON.stringify(registerSchema.parse(data)),
      })
    }),
  )
export const verifyEmail = createServerFn({ method: 'POST' })
  .validator((data: string) => data)
  .handler(({ data }) =>
    resultOf(async () => {
      return api().request<{ message: string }>(
        `/auth/verify-email/${encodeURIComponent(tokenSchema.parse(data))}/`,
      )
    }),
  )
export const resendVerification = createServerFn({ method: 'POST' })
  .validator((data: AccountEmailInput) => data)
  .handler(({ data }) =>
    resultOf(async () =>
      api().request<{ message: string }>('/auth/resend-verification/', {
        method: 'POST',
        body: JSON.stringify(accountEmailSchema.parse(data)),
      }),
    ),
  )
export const requestPasswordReset = createServerFn({ method: 'POST' })
  .validator((data: AccountEmailInput) => data)
  .handler(({ data }) =>
    resultOf(async () =>
      api().request<{ message: string }>('/auth/password-reset/', {
        method: 'POST',
        body: JSON.stringify(accountEmailSchema.parse(data)),
      }),
    ),
  )
export const validatePasswordReset = createServerFn({ method: 'GET' })
  .validator((data: ResetLinkInput) => data)
  .handler(({ data }) =>
    resultOf(async () => {
      const link = resetLinkSchema.parse(data)
      return api().request<{ valid: true }>(
        `/auth/password-reset/${encodeURIComponent(link.uid)}/${encodeURIComponent(link.token)}/`,
      )
    }),
  )
export const resetPassword = createServerFn({ method: 'POST' })
  .validator((data: ResetLinkInput & PasswordPairInput) => data)
  .handler(({ data }) =>
    resultOf(async () => {
      const link = resetLinkSchema.parse(data)
      const values = passwordPairSchema.parse(data)
      const response = await api().request<{ message: string }>(
        `/auth/password-reset/${encodeURIComponent(link.uid)}/${encodeURIComponent(link.token)}/`,
        { method: 'POST', body: JSON.stringify(values) },
      )
      await (await appSession()).clear()
      return response
    }),
  )
export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  await (await appSession()).clear()
})
export const getProfile = createServerFn({ method: 'GET' }).handler(() =>
  resultOf(async () =>
    api().authenticated<Profile>(await appSession(), '/auth/profile/'),
  ),
)
export const changePassword = createServerFn({ method: 'POST' })
  .validator((data: PasswordChangeInput) => data)
  .handler(({ data }) =>
    resultOf(async () => {
      const session = await appSession()
      const response = await api().authenticated<{ message: string }>(
        session,
        '/auth/password-change/',
        {
          method: 'POST',
          body: JSON.stringify(passwordChangeSchema.parse(data)),
        },
      )
      await session.clear()
      return response
    }),
  )
export const listSessions = createServerFn({ method: 'GET' }).handler(() =>
  resultOf(async () =>
    api().authenticated<MeditationSession[]>(
      await appSession(),
      '/meditations/sessions/',
    ),
  ),
)
export const listTypes = createServerFn({ method: 'GET' }).handler(() =>
  resultOf(async () =>
    api().authenticated<MeditationType[]>(
      await appSession(),
      '/meditations/types/',
    ),
  ),
)
export const getPracticeGoal = createServerFn({ method: 'GET' }).handler(() =>
  resultOf(async () =>
    api().authenticated<PracticeGoal>(await appSession(), '/meditations/goal/'),
  ),
)
export const savePracticeGoal = createServerFn({ method: 'POST' })
  .validator((data: PracticeGoalInput) => data)
  .handler(({ data }) =>
    resultOf(async () =>
      api().authenticated<PracticeGoal>(
        await appSession(),
        '/meditations/goal/',
        {
          method: 'PUT',
          body: JSON.stringify(practiceGoalSchema.parse(data)),
        },
      ),
    ),
  )
export const deletePracticeGoal = createServerFn({ method: 'POST' }).handler(
  () =>
    resultOf(async () =>
      api().authenticated<null>(await appSession(), '/meditations/goal/', {
        method: 'DELETE',
      }),
    ),
)
export const getSession = createServerFn({ method: 'GET' })
  .validator((data: number) => data)
  .handler(({ data }) =>
    resultOf(async () =>
      api().authenticated<MeditationSession>(
        await appSession(),
        `/meditations/sessions/${idSchema.parse(data)}/`,
      ),
    ),
  )
export const saveSession = createServerFn({ method: 'POST' })
  .validator(
    (data: { id?: number; values: SessionInput; timerScope?: string }) => data,
  )
  .handler(({ data }) =>
    resultOf(async () => {
      const session = await appSession()
      if (
        data.timerScope !== undefined &&
        data.timerScope !== session.data.timerScope
      ) {
        throw new ApiError({
          status: 409,
          message:
            'Your sign-in changed. Please begin a new session with this account.',
          fields: {},
        })
      }
      const id = data.id === undefined ? undefined : idSchema.parse(data.id)
      const payload = sessionPayload(sessionSchema.parse(data.values))
      return api().authenticated<MeditationSession>(
        session,
        `/meditations/sessions/${id === undefined ? '' : `${id}/`}`,
        {
          method: id === undefined ? 'POST' : 'PATCH',
          body: JSON.stringify(payload),
        },
      )
    }),
  )
export const deleteSession = createServerFn({ method: 'POST' })
  .validator((data: number) => data)
  .handler(({ data }) =>
    resultOf(async () =>
      api().authenticated<null>(
        await appSession(),
        `/meditations/sessions/${idSchema.parse(data)}/`,
        { method: 'DELETE' },
      ),
    ),
  )

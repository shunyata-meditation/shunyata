export type {
  AccountEmailInput,
  LoginInput,
  PasswordChangeInput,
  PasswordPairInput,
  PracticeGoalInput,
  RegisterInput,
  ResetLinkInput,
  SessionInput,
} from './validation'

export interface MeditationType {
  id: number
  name: string
}
export interface MeditationSession {
  id: number
  user: number
  meditation_type: number
  meditation_type_name: string
  start_time: string
  end_time: string
  duration: string
  completed: boolean
  notes: string
}
export interface PracticeGoal {
  weekly_minutes: number | null
}
export interface Profile {
  username: string
  email: string
}
export interface ApiProblem {
  status: number
  message: string
  fields: Record<string, string>
}
export type Result<T> = { ok: true; data: T } | { ok: false; error: ApiProblem }
export class ApiError extends Error {
  constructor(public problem: ApiProblem) {
    super(problem.message)
    this.name = 'ApiError'
  }
}
export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new ApiError(result.error)
  return result.data
}
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.'
}

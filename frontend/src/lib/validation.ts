import { z } from 'zod'

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Enter your username.'),
  password: z.string().min(1, 'Enter your password.'),
})
export const registerSchema = loginSchema
  .extend({
    email: z.email('Enter a valid email address.'),
    password_confirm: z.string().min(1, 'Confirm your password.'),
  })
  .refine((data) => data.password === data.password_confirm, {
    path: ['password_confirm'],
    message: 'Your passwords do not match.',
  })
export const sessionSchema = z
  .object({
    meditation_type: z.number().int().positive('Choose a meditation type.'),
    start_time: z.iso.datetime({ offset: true }),
    end_time: z.iso.datetime({ offset: true }).optional(),
    duration_seconds: z
      .number()
      .positive('Duration must be greater than zero.')
      .max(31536000, 'Duration cannot exceed one year.'),
    completed: z.boolean(),
    notes: z.string(),
  })
  .refine(
    (data) =>
      Number.isFinite(
        new Date(
          new Date(data.start_time).getTime() + data.duration_seconds * 1000,
        ).getTime(),
      ),
    { path: ['start_time'], message: 'Enter a valid session date.' },
  )
  .refine(
    (data) =>
      data.end_time === undefined ||
      Date.parse(data.end_time) - Date.parse(data.start_time) + 1 >=
        data.duration_seconds * 1000,
    {
      path: ['end_time'],
      message: 'The finish time must include all of your practice time.',
    },
  )
export const idSchema = z.number().int().positive()
export const practiceGoalSchema = z.object({
  weekly_minutes: z
    .number()
    .int('Enter a whole number of minutes.')
    .min(1, 'Your goal must be at least 1 minute.')
    .max(10_080, 'Your goal cannot exceed 10,080 minutes.'),
})
export const tokenSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{1,512}$/, 'This verification link is invalid.')
export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type SessionInput = z.infer<typeof sessionSchema>
export type PracticeGoalInput = z.infer<typeof practiceGoalSchema>

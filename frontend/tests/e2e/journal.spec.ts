import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function signIn(page: Page, username = 'river') {
  await page.goto('/login')
  await page.getByLabel('Username or email').fill(username)
  await page.getByLabel('Password', { exact: true }).fill('correct-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Your journal', exact: true }),
  ).toBeVisible()
}
async function logSession(page: Page) {
  await page
    .getByRole('link', { name: 'Log a session', exact: true })
    .last()
    .click()
  await page
    .getByRole('combobox', { name: 'Meditation type', exact: true })
    .selectOption('1')
  await page.getByLabel('Started at').fill('2026-09-22T10:30')
  await page.getByLabel('Duration').fill('12.5')
  await page.getByLabel('A reflection').fill('A little more room to breathe.')
  await page.getByRole('button', { name: 'Save session' }).click()
  await expect(page.getByText('A little more room to breathe.')).toBeVisible()
}
test.beforeEach(async ({ request }) => {
  await request.post('http://127.0.0.1:8100/__reset')
})

test('registration, explicit verification, and invalid links', async ({
  page,
}) => {
  await page.goto('/register')
  await page.getByLabel('Username', { exact: true }).fill('river')
  await page.getByLabel('Email address').fill('river@example.test')
  await page.getByLabel('Password', { exact: true }).fill('correct-password')
  await page.getByLabel('Confirm password').fill('different-password')
  await page.getByRole('button', { name: 'Create your account' }).click()
  await expect(page.getByText('Your passwords do not match.')).toBeVisible()
  await page.getByLabel('Confirm password').fill('correct-password')
  await page.getByRole('button', { name: 'Create your account' }).click()
  await expect(
    page.getByRole('heading', { name: 'Check your inbox.' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Resend verification email' }).click()
  await expect(page.getByText('another link is on its way')).toBeVisible()
  await page.goto('/api/auth/verify-email/valid-token')
  await page.reload() // Navigation and reload must not consume the single-use token.
  await page.getByRole('button', { name: 'Verify email' }).click()
  await expect(
    page.getByRole('heading', { name: 'You’re all set.' }),
  ).toBeVisible()
  await page.goto('/api/auth/verify-email/expired-token')
  await page.getByRole('button', { name: 'Verify email' }).click()
  await expect(
    page.getByText('Verification token has expired. Please request another.'),
  ).toBeVisible()
})

test('journal CRUD, cookie security, SSR reload, and account isolation', async ({
  page,
  context,
  request,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/sessions/new')
  await expect(page).toHaveURL(/\/login$/)
  await signIn(page)
  await expect(
    page.getByRole('heading', { name: 'A fresh page.' }),
  ).toBeVisible()
  const cookie = (await context.cookies()).find(
    (cookie) => cookie.name === 'shunyata-session',
  )
  expect(cookie?.httpOnly).toBe(true)
  expect(cookie?.sameSite).toBe('Lax')
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    'shunyata-session',
  )
  await logSession(page)
  await expect(page.getByText('12.5 min', { exact: true })).toBeVisible()
  const response = await page.reload()
  expect(response?.headers()['cache-control']).toContain('no-store')
  expect(await response?.text()).not.toContain('access-river')
  await expect(page.getByText('A little more room to breathe.')).toBeVisible()
  await page.getByRole('link', { name: 'Edit Mindfulness session' }).click()
  await page.getByLabel('A reflection').fill('Still here.')
  await page.getByLabel('I completed this session').uncheck()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Still here.')).toBeVisible()
  await expect(page.getByText('Unfinished', { exact: true })).toBeVisible()
  const stored = await (
    await request.get('http://127.0.0.1:8100/__sessions')
  ).json()
  expect(stored[0].duration).toBe('00:12:30')
  expect(
    Date.parse(stored[0].end_time) - Date.parse(stored[0].start_time),
  ).toBe(750000)
  await page.getByRole('button', { name: 'Delete Mindfulness session' }).click()
  await page.getByRole('button', { name: 'Keep entry' }).click()
  await expect(page.getByText('Still here.')).toBeVisible()
  await request.post('http://127.0.0.1:8100/__options', {
    data: { deleteFails: true },
  })
  await page.getByRole('button', { name: 'Delete Mindfulness session' }).click()
  await page.getByRole('button', { name: 'Delete entry', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByText('Still here.')).toBeVisible()
  await request.post('http://127.0.0.1:8100/__options', {
    data: { deleteFails: false },
  })
  await page.getByRole('button', { name: 'Delete entry', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'A fresh page.' }),
  ).toBeVisible()
  await logSession(page)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await signIn(page, 'willow')
  await expect(
    page.getByRole('heading', { name: 'A fresh page.' }),
  ).toBeVisible()
  await expect(page.getByText('A little more room to breathe.')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('unavailable API, empty types, expiry, and mobile keyboard layout', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page)
  await page.keyboard.press('Tab')
  await request.post('http://127.0.0.1:8100/__options', {
    data: { unavailable: true },
  })
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('unavailable')
  await request.post('http://127.0.0.1:8100/__options', {
    data: { unavailable: false, noTypes: true },
  })
  await page
    .getByRole('link', { name: 'Log a session', exact: true })
    .first()
    .click()
  await expect(
    page.getByText('No meditation types are available yet.', { exact: false }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await request.post('http://127.0.0.1:8100/__options', {
    data: { expired: true },
  })
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
})

test('responsive journal and form remain accessible without overflow', async ({
  page,
  request,
}, testInfo) => {
  await page.goto('/login')
  await page.screenshot({
    path: testInfo.outputPath('login-desktop.png'),
    fullPage: true,
  })
  await signIn(page)
  for (const [index, type] of [1, 2, 1].entries()) {
    await request.post('http://127.0.0.1:8100/api/meditations/sessions/', {
      headers: { Authorization: 'Bearer access-river' },
      data: {
        meditation_type: type,
        start_time: `2026-09-${22 - index}T07:00:00Z`,
        end_time: `2026-09-${22 - index}T07:15:00Z`,
        duration: '00:15:00',
        completed: index !== 2,
        notes: [
          'The morning was quiet. I noticed the light moving across the room.',
          'A softer place to land after a long day.',
          'Some days, simply showing up is enough.',
        ][index],
      },
    })
  }
  await page.reload()
  await expect(
    page.getByText('A softer place to land after a long day.'),
  ).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('journal-desktop.png'),
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({
    path: testInfo.outputPath('journal-mobile.png'),
    fullPage: true,
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page
    .getByRole('link', { name: 'Log a session', exact: true })
    .first()
    .click()
  await expect(
    page.getByRole('combobox', { name: 'Meditation type', exact: true }),
  ).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('form-mobile.png'),
    fullPage: true,
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe(
    'BODY',
  )
})

test('statistics show completed progress, streaks, and persistent goals', async ({
  page,
  request,
}) => {
  await signIn(page)
  const localNoonIso = (daysAgo: number) => {
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)
    date.setHours(12, 0, 0, 0)
    return date.toISOString()
  }
  for (const [index, entry] of [
    { daysAgo: 1, duration: '00:15:00', completed: true },
    { daysAgo: 0, duration: '00:10:00', completed: true },
    { daysAgo: 0, duration: '00:30:00', completed: false },
  ].entries()) {
    await request.post('http://127.0.0.1:8100/api/meditations/sessions/', {
      headers: { Authorization: 'Bearer access-river' },
      data: {
        meditation_type: 1,
        start_time: localNoonIso(entry.daysAgo),
        end_time: localNoonIso(entry.daysAgo),
        duration: entry.duration,
        completed: entry.completed,
        notes: `Statistics fixture ${index}`,
      },
    })
  }
  await page.reload()
  await page.getByRole('link', { name: 'Statistics' }).click()
  await expect(page.getByText('25', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Set a gentle goal' }),
  ).toBeVisible()
  await page.getByLabel('Weekly minutes').fill('30')
  await page.getByRole('button', { name: 'Save goal' }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '25',
  )
  await expect(page.getByText('83%', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('25 of 30 minutes')).toBeVisible()
  await page.getByRole('button', { name: 'Edit goal' }).click()
  await page.getByLabel('Weekly minutes').fill('20')
  await page.getByRole('button', { name: 'Save goal' }).click()
  await expect(page.getByText('125%', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Remove goal' }).click()
  await expect(
    page.getByRole('heading', { name: 'Set a gentle goal' }),
  ).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test('account recovery and profile password change complete securely', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login')
  await page.getByRole('link', { name: 'Forgot your password?' }).click()
  await page.getByLabel('Email address').fill('river@example.test')
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(
    page.getByRole('heading', { name: 'Check your inbox.' }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)

  await page.goto('/reset-password/fixture-user/valid-reset')
  await page.getByLabel('New password', { exact: true }).fill('reset-password')
  await page.getByLabel('Confirm new password').fill('reset-password')
  await page.getByRole('button', { name: 'Set new password' }).click()
  await expect(
    page.getByRole('heading', { name: 'Your password is ready.' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Continue to sign in' }).click()
  await page.getByLabel('Username or email').fill('river')
  await page.getByLabel('Password', { exact: true }).fill('reset-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)

  await page.getByRole('link', { name: 'Profile' }).click()
  await expect(page.getByText('river@example.test')).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.getByLabel('Current password').fill('wrong-password')
  await page
    .getByLabel('New password', { exact: true })
    .fill('profile-password')
  await page.getByLabel('Confirm new password').fill('profile-password')
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(
    page.getByText('Your current password is incorrect.'),
  ).toBeVisible()
  await page.getByLabel('Current password').fill('reset-password')
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(
    page.getByText(
      'Your password has been changed. Sign in again on this device.',
    ),
  ).toBeVisible()
  await page.getByLabel('Username or email').fill('river')
  await page.getByLabel('Password', { exact: true }).fill('profile-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('invalid credentials show an error and cross-site login requests are rejected', async ({
  page,
  request,
}) => {
  await page.goto('/login')
  await page.getByLabel('Username or email').fill('river')
  await page.getByLabel('Password', { exact: true }).fill('wrong-password')
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes('/_serverFn/'),
  )
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  const response = await responsePromise
  expect(response.headers()['cache-control']).toContain('no-store')
  await expect(page.getByRole('alert')).toContainText('No active account found')
  const rejected = await request.post(response.url(), {
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://untrusted.example',
      'Sec-Fetch-Site': 'cross-site',
    },
    data: response.request().postData() ?? '',
  })
  expect(rejected.status()).toBe(403)
})

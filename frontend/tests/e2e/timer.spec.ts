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
async function start(page: Page, sound = false) {
  await page.getByRole('link', { name: 'Timer', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Meditation type' })
    .selectOption('1')
  await page.getByLabel('Duration (minutes)').fill('1')
  if (!sound)
    await page
      .getByRole('checkbox', { name: 'Gentle completion bell' })
      .uncheck()
  await page.getByRole('button', { name: 'Begin practice' }).click()
  await expect(page.getByRole('timer')).toHaveText('01:00')
}
async function installAudio(page: Page, blocked = false) {
  await page.addInitScript(
    ({ blocked }) => {
      let tones = 0
      class FakeAudio {
        state = 'suspended'
        currentTime = 0
        destination = {}
        constructor() {
          if (blocked) throw new Error('Audio unavailable')
        }
        async resume() {
          this.state = 'running'
        }
        async close() {
          this.state = 'closed'
        }
        createOscillator() {
          return {
            frequency: { value: 0 },
            connect: () => ({ connect: () => {} }),
            start: () => {
              document.documentElement.dataset.bellTones = String(++tones)
            },
            stop: () => {},
            disconnect: () => {},
            onended: null,
          }
        }
        createGain() {
          return {
            gain: {
              setValueAtTime: () => {},
              linearRampToValueAtTime: () => {},
              exponentialRampToValueAtTime: () => {},
            },
            disconnect: () => {},
          }
        }
      }
      Object.defineProperty(window, 'AudioContext', {
        value: FakeAudio,
        configurable: true,
      })
    },
    { blocked },
  )
}

test.beforeEach(async ({ page, request }) => {
  await request.post('http://127.0.0.1:8100/__reset')
  await page.clock.install({ time: new Date('2026-09-22T10:00:00Z') })
  await page.clock.pauseAt(new Date('2026-09-22T10:01:00Z'))
})

test('pause, navigate, restore, and save active time with its real end', async ({
  page,
  request,
}, testInfo) => {
  await signIn(page)
  await start(page)
  await page.screenshot({
    path: testInfo.outputPath('timer-desktop.png'),
    fullPage: true,
  })
  await page.clock.fastForward(20_000)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.getByRole('timer')).toHaveText('00:40')
  await page.clock.fastForward(90_000)
  await page.getByRole('link', { name: 'Journal', exact: true }).click()
  await expect(page.getByText('Your practice is paused')).toBeVisible()
  await page.getByRole('link', { name: /Return to timer/ }).click()
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Resume', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('timer')).toHaveText('00:40')
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await page.clock.fastForward(40_000)
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible()
  await page
    .getByLabel('A reflection')
    .fill('The pause was part of the practice.')
  await page.reload()
  await expect(page.getByLabel('A reflection')).toHaveValue(
    'The pause was part of the practice.',
  )
  await request.post('http://127.0.0.1:8100/__options', {
    data: { unavailable: true },
  })
  await page.getByRole('button', { name: 'Save session' }).click()
  await expect(page.getByRole('alert')).toContainText('unavailable')
  await expect(page.getByLabel('A reflection')).toHaveValue(
    'The pause was part of the practice.',
  )
  await request.post('http://127.0.0.1:8100/__options', {
    data: { unavailable: false },
  })
  await page.getByRole('button', { name: 'Save session' }).click()
  await expect(
    page.getByText('The pause was part of the practice.'),
  ).toBeVisible()
  let entries = await (
    await request.get('http://127.0.0.1:8100/__sessions')
  ).json()
  expect(entries).toHaveLength(1)
  expect(entries[0].duration).toBe('00:01:00')
  expect(entries[0].completed).toBe(true)
  expect(
    Date.parse(entries[0].end_time) - Date.parse(entries[0].start_time),
  ).toBe(150_000)
  const originalEnd = entries[0].end_time
  expect(
    await page.evaluate(() => sessionStorage.getItem('shunyata.timer.v1')),
  ).toBeNull()
  await page.getByRole('link', { name: 'Edit Mindfulness session' }).click()
  await page.getByLabel('A reflection').fill('Still here, with more space.')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.clock.runFor(1)
  await expect(page.getByText('Still here, with more space.')).toBeVisible()
  entries = await (await request.get('http://127.0.0.1:8100/__sessions')).json()
  expect(entries[0].end_time).toBe(originalEnd)
})

test('running refresh recovery, early finish, and discard confirmation', async ({
  page,
  request,
}) => {
  await signIn(page)
  await start(page)
  await page.clock.fastForward(12_000)
  await page.reload()
  await expect(page.getByRole('timer')).toHaveText('00:48')
  await page.getByRole('button', { name: 'Finish early' }).click()
  await expect(page.getByText('Unfinished', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Discard', exact: true }).click()
  await page.getByRole('button', { name: 'Keep session', exact: true }).click()
  await page.getByRole('button', { name: 'Save session' }).click()
  await expect(
    page.getByRole('heading', { name: 'Your journal', exact: true }),
  ).toBeVisible()
  const entries = await (
    await request.get('http://127.0.0.1:8100/__sessions')
  ).json()
  expect(entries).toHaveLength(1)
  expect(entries[0].duration).toBe('00:00:12')
  expect(entries[0].completed).toBe(false)
  await start(page)
  await page.getByRole('button', { name: 'Finish early' }).click()
  await expect(
    page.getByRole('button', { name: 'Save session' }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Discard', exact: true }).click()
  await page
    .getByRole('button', { name: 'Discard session', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Begin practice' }),
  ).toBeVisible()
})

test('completion bell plays once and restored completed timers stay silent', async ({
  page,
}) => {
  await installAudio(page)
  await signIn(page)
  await start(page, true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Enable bell' })).toBeVisible()
  await page.getByRole('button', { name: 'Enable bell' }).click()
  await page.clock.fastForward(60_000)
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible()
  expect(await page.locator('html').getAttribute('data-bell-tones')).toBe('3')
  await page.clock.fastForward(60_000)
  expect(await page.locator('html').getAttribute('data-bell-tones')).toBe('3')
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible()
  expect(await page.locator('html').getAttribute('data-bell-tones')).toBeNull()
})

test('restores expired deadlines without a bell and handles blocked sound', async ({
  page,
}) => {
  await installAudio(page, true)
  await signIn(page)
  await start(page, true)
  await expect(
    page.getByText('Sound is unavailable right now.', { exact: false }),
  ).toBeVisible()
  await page.goto('/login') // Already signed in; return to journal, preserving timer.
  await page.clock.fastForward(70_000)
  await page.getByRole('link', { name: /Return to timer/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible()
})

test('logout confirms discard and another account cannot restore the draft', async ({
  page,
}) => {
  await signIn(page)
  await start(page)
  const snapshot = await page.evaluate(() =>
    sessionStorage.getItem('shunyata.timer.v1'),
  )
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByRole('button', { name: 'Stay here' }).click()
  await expect(page.getByRole('timer')).toBeVisible()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.getByRole('button', { name: 'Discard and sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(
    await page.evaluate(() => sessionStorage.getItem('shunyata.timer.v1')),
  ).toBeNull()
  await page.evaluate(
    (snapshot) => sessionStorage.setItem('shunyata.timer.v1', snapshot!),
    snapshot,
  )
  await signIn(page, 'willow')
  await page.getByRole('link', { name: 'Timer', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Begin practice' }),
  ).toBeVisible()
  expect(
    await page.evaluate(() => sessionStorage.getItem('shunyata.timer.v1')),
  ).toBeNull()
})

test('storage failure still permits a timer and mobile controls fit', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', {
      get() {
        throw new Error('Storage blocked')
      },
    })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page)
  await start(page)
  await expect(
    page.getByText('This browser cannot store your timer.', { exact: false }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: testInfo.outputPath('timer-mobile.png'),
    fullPage: true,
  })
  await page.clock.fastForward(60_000)
  await expect(page.getByRole('button', { name: 'Save session' })).toBeEnabled()
  await page.screenshot({
    path: testInfo.outputPath('timer-review-mobile.png'),
    fullPage: true,
  })
})

test('a timer cannot be saved under an account signed in through another tab', async ({
  page,
  context,
  request,
}) => {
  await signIn(page)
  await request.post('http://127.0.0.1:8100/api/meditations/sessions/', {
    headers: { Authorization: 'Bearer access-river' },
    data: {
      meditation_type: 1,
      start_time: '2026-09-21T10:00:00Z',
      end_time: '2026-09-21T10:01:00Z',
      duration: '00:01:00',
      completed: true,
      notes: 'An earlier private reflection.',
    },
  })
  await page.reload()
  await expect(page.getByText('An earlier private reflection.')).toBeVisible()
  await start(page)
  await page.clock.fastForward(10_000)
  await page.getByRole('button', { name: 'Finish early' }).click()
  await page.getByLabel('A reflection').fill('Only for the original account.')
  await page.clock.resume() // The review is fixed; let query notifications run normally.
  const otherTab = await context.newPage()
  await otherTab.goto('/')
  await otherTab.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(otherTab).toHaveURL(/\/login$/)
  await signIn(otherTab, 'willow')
  await page.getByRole('button', { name: 'Save session' }).click()
  await expect(
    page.getByRole('button', { name: 'Begin practice' }),
  ).toBeVisible()
  expect(
    await (await request.get('http://127.0.0.1:8100/__sessions')).json(),
  ).toHaveLength(1)
  expect(
    await page.evaluate(() => sessionStorage.getItem('shunyata.timer.v1')),
  ).toBeNull()
  await page.getByRole('link', { name: 'Journal', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'A fresh page.' }),
  ).toBeVisible()
  await expect(page.getByText('An earlier private reflection.')).toHaveCount(0)
  await otherTab.close()
})

test('a readable draft survives when storage writes are blocked after refresh', async ({
  page,
}) => {
  await signIn(page)
  await start(page)
  await page.clock.fastForward(15_000)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage full', 'QuotaExceededError')
    }
  })
  await page.reload()
  await expect(page.getByRole('timer')).toHaveText('00:45')
  await expect(
    page.getByText('This browser cannot store your timer.', { exact: false }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await page.clock.fastForward(45_000)
  await expect(page.getByRole('button', { name: 'Save session' })).toBeEnabled()
})

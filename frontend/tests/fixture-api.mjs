// A local, deterministic Django-contract fixture. Never used by the application.
import { createServer } from 'node:http'
let sessions = []
let nextId = 1
let verified = false
let options = {}
let goals = {}
let passwords = {}
let resetUsed = false
const types = [
  { id: 1, name: 'Mindfulness' },
  { id: 2, name: 'Body Scan' },
]
createServer(async (req, res) => {
  let text = ''
  for await (const chunk of req) text += chunk
  const body = text ? JSON.parse(text) : {}
  const send = (status, value) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(value === null ? '' : JSON.stringify(value))
  }
  const path = req.url
  if (path === '/health') return send(200, {})
  if (path === '/__reset') {
    sessions = []
    nextId = 1
    verified = false
    options = {}
    goals = {}
    passwords = {}
    resetUsed = false
    return send(200, {})
  }
  if (path === '/__options') {
    options = { ...options, ...body }
    return send(200, {})
  }
  if (path === '/__sessions') return send(200, sessions)
  if (path === '/api/auth/register/') {
    if (body.username === 'taken')
      return send(400, {
        username: ['A user with that username already exists.'],
      })
    return send(201, {
      message:
        'Registration successful. Please check your email to verify your account.',
    })
  }
  if (path.startsWith('/api/auth/verify-email/')) {
    if (path.includes('expired'))
      return send(400, {
        error: 'Verification token has expired. Please request another.',
      })
    if (verified) return send(400, { error: 'Invalid verification token.' })
    verified = true
    return send(200, { message: 'Email verified successfully.' })
  }
  if (path === '/api/auth/login/') {
    if (body.password !== (passwords[body.username] ?? 'correct-password'))
      return send(401, {
        detail: 'No active account found with the given credentials',
      })
    return send(200, {
      access: `access-${body.username}`,
      refresh: `refresh-${body.username}`,
    })
  }
  if (path === '/api/auth/refresh/')
    return options.expired
      ? send(401, { detail: 'Token is expired' })
      : send(200, { access: body.refresh.replace('refresh-', 'access-') })
  if (path === '/api/auth/resend-verification/')
    return send(200, {
      message:
        'If an unverified account uses that email, a verification link is on its way.',
    })
  if (path === '/api/auth/password-reset/')
    return send(200, {
      message:
        'If an eligible account uses that email, a password reset link is on its way.',
    })
  if (path === '/api/auth/password-reset/fixture-user/valid-reset/') {
    if (resetUsed)
      return send(400, {
        error: 'This password reset link is invalid or has expired.',
      })
    if (req.method === 'GET') return send(200, { valid: true })
    passwords.river = body.new_password
    resetUsed = true
    return send(200, { message: 'Your password has been reset.' })
  }
  if (path.startsWith('/api/auth/password-reset/'))
    return send(400, {
      error: 'This password reset link is invalid or has expired.',
    })
  if (!req.headers.authorization || options.expired)
    return send(401, {
      detail: 'Authentication credentials were not provided.',
    })
  const user = req.headers.authorization.replace('Bearer access-', '')
  if (path === '/api/auth/profile/')
    return send(200, { username: user, email: `${user}@example.test` })
  if (path === '/api/auth/password-change/') {
    if (body.current_password !== (passwords[user] ?? 'correct-password'))
      return send(400, {
        current_password: ['Your current password is incorrect.'],
      })
    passwords[user] = body.new_password
    return send(200, { message: 'Your password has been changed.' })
  }
  if (path === '/api/meditations/goal/') {
    if (options.goalFails) return send(503, { detail: 'Unavailable' })
    if (req.method === 'GET')
      return send(200, { weekly_minutes: goals[user] ?? null })
    if (req.method === 'DELETE') {
      delete goals[user]
      return send(204, null)
    }
    if (
      !Number.isInteger(body.weekly_minutes) ||
      body.weekly_minutes < 1 ||
      body.weekly_minutes > 10080
    )
      return send(400, {
        weekly_minutes: ['Enter a value from 1 to 10080.'],
      })
    goals[user] = body.weekly_minutes
    return send(200, { weekly_minutes: goals[user] })
  }
  if (path === '/api/meditations/types/')
    return send(200, options.noTypes ? [] : types)
  if (path === '/api/meditations/sessions/') {
    if (options.unavailable) return send(503, { detail: 'Unavailable' })
    if (req.method === 'GET')
      return send(
        200,
        sessions.filter((entry) => entry.owner === user),
      )
    const entry = {
      ...body,
      id: nextId++,
      user: 1,
      owner: user,
      meditation_type_name: types.find(
        (type) => type.id === body.meditation_type,
      )?.name,
    }
    sessions.push(entry)
    return send(201, entry)
  }
  const match = /^\/api\/meditations\/sessions\/(\d+)\/$/.exec(path)
  if (match) {
    const entry = sessions.find(
      (entry) => entry.id === Number(match[1]) && entry.owner === user,
    )
    if (!entry) return send(404, { detail: 'Not found.' })
    if (req.method === 'GET') return send(200, entry)
    if (req.method === 'DELETE') {
      if (options.deleteFails) return send(500, {})
      sessions = sessions.filter((item) => item !== entry)
      return send(204, null)
    }
    Object.assign(entry, body, {
      meditation_type_name: types.find(
        (type) => type.id === body.meditation_type,
      )?.name,
    })
    return send(200, entry)
  }
  send(404, { detail: 'Not found.' })
}).listen(8100, '127.0.0.1')

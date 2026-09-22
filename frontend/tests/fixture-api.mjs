// A local, deterministic Django-contract fixture. Never used by the application.
import { createServer } from 'node:http'
let sessions = []
let nextId = 1
let verified = false
let options = {}
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
        error: 'Verification token has expired. Please register again.',
      })
    if (verified) return send(400, { error: 'Invalid verification token.' })
    verified = true
    return send(200, { message: 'Email verified successfully.' })
  }
  if (path === '/api/auth/login/') {
    if (body.password !== 'correct-password')
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
  if (!req.headers.authorization || options.expired)
    return send(401, {
      detail: 'Authentication credentials were not provided.',
    })
  const user = req.headers.authorization.replace('Bearer access-', '')
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

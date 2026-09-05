
import { describe, it, expect } from 'vitest'
import { beforeEach } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { resetRateLimiter } from '../src/middleware/rateLimiter.js'

beforeEach(() => resetRateLimiter())

/**
 * Discord and SMTP credentials are blanked in tests/setup.ts, so both channels
 * report themselves disabled and nothing can be delivered anywhere. Requests
 * that pass validation therefore end in a 502 RelayError — which is exactly the
 * response shape that used to crash the portfolio's contact form.
 */
const send = (body: unknown) =>
  request(app).post('/api/messages').set('Content-Type', 'application/json').send(body as object)

const valid = { name: 'Tester', email: 'a@b.com', message: 'Hello there' }

describe('POST /api/messages — validation', () => {
  it('requires a name', async () => {
    const res = await send({ ...valid, name: '' })
    expect(res.status).toBe(400)
    expect(res.body.error.message).toMatch(/name/i)
  })

  it('requires a message', async () => {
    const res = await send({ ...valid, message: '   ' })
    expect(res.status).toBe(400)
    expect(res.body.error.message).toMatch(/message/i)
  })

  it('requires at least one contact channel', async () => {
    const res = await send({ name: 'T', message: 'Hi', email: '', discordId: '' })
    expect(res.status).toBe(400)
    expect(res.body.error.message).toMatch(/email|discord/i)
  })

  it('accepts a Discord ID alone', async () => {
    const res = await send({ name: 'T', message: 'Hi', discordId: 'user#1234' })
    expect(res.status).toBe(502) // passed validation, no channel configured
  })
})

describe('POST /api/messages — field limits', () => {
  it.each([
    ['message', 3001, /Message is too long/i],
    ['name', 101, /Name is too long/i],
    ['subject', 201, /Subject is too long/i],
    ['discordId', 101, /Discord ID is too long/i],
  ])('rejects an over-length %s', async (field, length, pattern) => {
    const res = await send({ ...valid, [field]: 'A'.repeat(length) })
    expect(res.status).toBe(400)
    expect(res.body.error.message).toMatch(pattern)
  })

  it('accepts a message exactly at the limit', async () => {
    const res = await send({ ...valid, message: 'A'.repeat(3000) })
    expect(res.status).toBe(502) // validation passed
  })
})

describe('error response shape', () => {
  it('always nests the message under error.message', async () => {
    // The portfolio reads this shape; a bare string here would be inconsistent
    // with the rest of the API surface.
    const res = await send({ ...valid, name: '' })
    expect(typeof res.body.error).toBe('object')
    expect(typeof res.body.error.message).toBe('string')
    expect(res.body.success).toBe(false)
  })
})

describe('GET /api/health', () => {
  it('reports both channels as unconfigured in tests', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.data.channels.discord.configured).toBe(false)
    expect(res.body.data.channels.email.configured).toBe(false)
  })
})

describe('unknown routes', () => {
  it('404s with a structured error', async () => {
    const res = await request(app).get('/api/nope')
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })
})

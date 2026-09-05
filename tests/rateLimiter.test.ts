
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { resetRateLimiter } from '../src/middleware/rateLimiter.js'

const valid = { name: 'T', email: 'a@b.com', message: 'Hi' }
const post = (headers: Record<string, string> = {}) =>
  request(app).post('/api/messages').set(headers).send(valid)

beforeEach(() => resetRateLimiter())

describe('rate limiter', () => {
  it('allows requests up to the limit, then returns 429', async () => {
    const codes: number[] = []
    for (let i = 0; i < 8; i++) codes.push((await post()).status)

    // 5 per minute by default; the first five pass validation and reach the
    // (unconfigured) delivery stage, the rest are throttled.
    expect(codes.filter((c) => c !== 429)).toHaveLength(5)
    expect(codes.filter((c) => c === 429)).toHaveLength(3)
  })

  it('sets Retry-After on a throttled response', async () => {
    for (let i = 0; i < 5; i++) await post()
    const res = await post()

    expect(res.status).toBe(429)
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
  })

  it('cannot be bypassed by rotating X-Forwarded-For behind the tunnel', async () => {
    // The real topology: Cloudflare's edge fixes CF-Connecting-IP to the true
    // client, and the attacker controls only what they sent — the XFF chain.
    // This is the bypass the original implementation allowed.
    const codes: number[] = []
    for (let i = 0; i < 8; i++) {
      codes.push((await post({
        'CF-Connecting-IP': '203.0.113.50',
        'X-Forwarded-For': `10.${i}.${i}.${i}, 203.0.113.50`,
      })).status)
    }
    expect(codes.filter((c) => c !== 429)).toHaveLength(5)
    expect(codes.filter((c) => c === 429)).toHaveLength(3)
  })

  it('ignores forwarding headers entirely from an untrusted peer', async () => {
    // Documents the boundary: headers are believed only from a trusted peer.
    // Loopback is trusted here, so this asserts the resolver directly rather
    // than through supertest, which can only connect from loopback.
    const { resolveClientIp, buildTrustedPeers } = await import('../src/utils/clientIp.js')
    const peers = buildTrustedPeers('loopback')

    const resolved = resolveClientIp(
      {
        headers: { 'cf-connecting-ip': '1.2.3.4', 'x-forwarded-for': '5.6.7.8' },
        socket: { remoteAddress: '198.51.100.77' },
        ip: '1.2.3.4',
      },
      { source: 'auto', trustedPeers: peers },
    )

    expect(resolved).toBe('198.51.100.77')
  })

  it('gives genuinely different clients their own quota', async () => {
    // Loopback is a trusted peer here, so CF-Connecting-IP is authoritative.
    const codes: number[] = []
    for (let i = 0; i < 6; i++) {
      codes.push((await post({ 'CF-Connecting-IP': `198.51.100.${i}` })).status)
    }
    expect(codes.filter((c) => c === 429)).toHaveLength(0)
  })
})

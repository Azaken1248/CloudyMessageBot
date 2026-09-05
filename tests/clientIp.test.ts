/**
 * MIRRORED TEST SUITE — the module under test is duplicated across the two
 * services (see the header in clientIp.ts). Keeping the tests identical means a
 * behavioural drift between the copies fails on one side.
 */

import { describe, it, expect } from 'vitest'
import {
  buildTrustedPeers, resolveClientIp, toRateLimitKey, normalizeIp, isValidIp,
} from '../src/utils/clientIp.js'

const req = (peer: string, headers: Record<string, string> = {}, ip?: string) =>
  ({ headers, socket: { remoteAddress: peer }, ip })

const loopback = buildTrustedPeers('loopback')

describe('resolveClientIp — trust is anchored to the socket peer', () => {
  it('believes CF-Connecting-IP from a trusted peer (tunnel topology)', () => {
    expect(resolveClientIp(req('127.0.0.1', { 'cf-connecting-ip': '203.0.113.9' }),
      { source: 'auto', trustedPeers: loopback })).toBe('203.0.113.9')
  })

  it('IGNORES a forged CF-Connecting-IP from an untrusted peer', () => {
    // The case that matters if the origin is ever exposed directly.
    expect(resolveClientIp(req('198.51.100.7', { 'cf-connecting-ip': '1.2.3.4' }, '1.2.3.4'),
      { source: 'auto', trustedPeers: loopback })).toBe('198.51.100.7')
  })

  it('falls back to X-Forwarded-For via req.ip when no CF header is present', () => {
    expect(resolveClientIp(req('127.0.0.1', {}, '203.0.113.20'),
      { source: 'auto', trustedPeers: loopback })).toBe('203.0.113.20')
  })

  it('rejects a malformed header value rather than using it as a key', () => {
    expect(resolveClientIp(req('127.0.0.1', { 'cf-connecting-ip': 'not-an-ip; DROP TABLE' }, '203.0.113.30'),
      { source: 'auto', trustedPeers: loopback })).toBe('203.0.113.30')
  })

  it('honours source=socket by ignoring every header', () => {
    expect(resolveClientIp(req('127.0.0.1', { 'cf-connecting-ip': '203.0.113.9' }),
      { source: 'socket', trustedPeers: loopback })).toBe('127.0.0.1')
  })

  it('honours an explicitly trusted off-host proxy', () => {
    const peers = buildTrustedPeers('private')
    expect(resolveClientIp(req('10.0.0.5', { 'cf-connecting-ip': '203.0.113.40' }),
      { source: 'auto', trustedPeers: peers })).toBe('203.0.113.40')
  })
})

describe('normalizeIp / isValidIp', () => {
  it('unwraps IPv4-mapped IPv6 so one client is one bucket', () => {
    expect(normalizeIp('::ffff:127.0.0.1')).toBe('127.0.0.1')
  })
  it('validates addresses', () => {
    expect(isValidIp('203.0.113.1')).toBe(true)
    expect(isValidIp('nonsense')).toBe(false)
  })
})

describe('toRateLimitKey', () => {
  it('buckets an IPv6 client by /64 so it cannot rotate within its block', () => {
    const a = toRateLimitKey('2001:db8:abcd:1234::1')
    const b = toRateLimitKey('2001:db8:abcd:1234:ffff:ffff:ffff:ffff')
    const c = toRateLimitKey('2001:db8:abcd:9999::1')
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
  it('uses IPv4 addresses whole', () => {
    expect(toRateLimitKey('203.0.113.1')).toBe('203.0.113.1')
  })
})

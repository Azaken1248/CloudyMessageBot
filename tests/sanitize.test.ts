
import { describe, it, expect } from 'vitest'
import { escapeHtml, escapeMarkdown, truncate, isLikelyEmail, mailtoHref } from '../src/utils/sanitize.js'

describe('escapeHtml', () => {
  it.each([
    ['<script>alert(1)</script>', /^&lt;script&gt;/],
    ['<img src=x onerror="alert(1)">', /&quot;/],
    ['" onmouseover="alert(1)', /^&quot;/],
    ["it's", /&#39;/],
    ['a & b', /&amp;/],
  ])('neutralises %s', (input, expected) => {
    const out = escapeHtml(input)
    expect(out).toMatch(expected)
    expect(out).not.toMatch(/<[a-z/!]/i)
  })

  it('leaves ordinary text untouched', () => {
    expect(escapeHtml('Hello there, friend')).toBe('Hello there, friend')
  })
})

describe('escapeMarkdown', () => {
  it('escapes a code fence so it cannot close the metadata block', () => {
    const out = escapeMarkdown('hi ```ansi FAKE')
    expect(out).not.toMatch(/(^|[^\\])```/)
  })
  it('escapes emphasis characters', () => {
    expect(escapeMarkdown('**bold** _em_')).toContain('\\*')
  })
})

describe('escapeMarkdown leaves ordinary prose intact', () => {
  // Escaping punctuation Discord does not treat as markdown produced visible
  // backslashes in every real message; these are the shapes people actually send.
  it.each([
    "I'd like a half-body commission - is that possible?",
    'My budget is $50-80. Can you do a re-draw of my OC?',
    'Email me at artist@example.com :)',
    'See ref #3 - the one with the cat-ears',
    'Deadline: next Friday',
  ])('passes through unchanged: %s', (message) => {
    expect(escapeMarkdown(message)).toBe(message)
  })

  it('still neutralises the characters Discord does format', () => {
    expect(escapeMarkdown('**bold**')).toBe('\\*\\*bold\\*\\*')
    expect(escapeMarkdown('__under__')).toBe('\\_\\_under\\_\\_')
    expect(escapeMarkdown('~~strike~~')).toBe('\\~\\~strike\\~\\~')
    expect(escapeMarkdown('||spoiler||')).toBe('\\|\\|spoiler\\|\\|')
    expect(escapeMarkdown('> quote')).toBe('\\> quote')
  })
})

describe('truncate', () => {
  it('caps at the limit and marks the cut', () => {
    const out = truncate('A'.repeat(100), 10)
    expect(out.length).toBe(10)
    expect(out.endsWith('…')).toBe(true)
  })
  it('leaves shorter input alone', () => {
    expect(truncate('short', 100)).toBe('short')
  })
})

describe('isLikelyEmail', () => {
  it.each(['a@b.co', 'first.last+tag@sub.example.com'])('accepts %s', (v) => {
    expect(isLikelyEmail(v)).toBe(true)
  })
  it.each([
    'a@b.com" onmouseover="alert(1)',
    'no-at-sign',
    'spaces in@example.com',
    'a@b',
    '<script>@evil.com',
  ])('rejects %s', (v) => {
    expect(isLikelyEmail(v)).toBe(false)
  })
  it('rejects an over-long address', () => {
    expect(isLikelyEmail('a'.repeat(250) + '@example.com')).toBe(false)
  })
})

describe('mailtoHref', () => {
  it('percent-encodes then escapes for attribute context', () => {
    expect(mailtoHref('dev+tag@example.com')).toBe('mailto:dev%2Btag%40example.com')
  })
})

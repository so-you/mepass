import { describe, it, expect } from 'vitest'
import { normalizeTags } from '../src/core/tags.js'

describe('tags', () => {
  it('normalizes tags with trim, lowercase, and dedup', () => {
    expect(normalizeTags('#AI, openai, ai', 'api_key')).toBe('ai,api_key,openai')
  })

  it('adds type tag automatically', () => {
    expect(normalizeTags('', 'account')).toBe('account')
    expect(normalizeTags(undefined, 'email')).toBe('email')
  })

  it('handles empty input', () => {
    expect(normalizeTags('', 'note')).toBe('note')
    expect(normalizeTags(undefined, 'note')).toBe('note')
  })

  it('handles single tag', () => {
    expect(normalizeTags('work', 'account')).toBe('account,work')
  })

  it('removes hash prefix', () => {
    expect(normalizeTags('#work, #personal', 'account')).toBe('account,personal,work')
  })

  it('deduplicates tags', () => {
    expect(normalizeTags('ai, AI, #ai', 'api_key')).toBe('ai,api_key')
  })

  it('filters empty tags', () => {
    expect(normalizeTags('work,,  ,personal', 'account')).toBe('account,personal,work')
  })

  it('sorts tags alphabetically', () => {
    expect(normalizeTags('zebra,apple,mango', 'account')).toBe('account,apple,mango,zebra')
  })

  it('handles array input', () => {
    expect(normalizeTags(['work', 'personal'], 'email')).toBe('email,personal,work')
  })
})

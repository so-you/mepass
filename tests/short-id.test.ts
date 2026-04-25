import { describe, it, expect } from 'vitest'
import { generateShortId, isValidShortId, getShortIdType } from '../src/core/short-id.js'

describe('short-id', () => {
  it('generates valid short IDs for each type', () => {
    const types = ['account', 'email', 'api_key', 'note'] as const
    for (const type of types) {
      const id = generateShortId(type)
      expect(id).toHaveLength(6)
      expect(/^\d{6}$/.test(id)).toBe(true)
      expect(isValidShortId(id)).toBe(true)
    }
  })

  it('generates correct type prefix', () => {
    expect(generateShortId('account')[0]).toBe('0')
    expect(generateShortId('email')[0]).toBe('1')
    expect(generateShortId('api_key')[0]).toBe('2')
    expect(generateShortId('note')[0]).toBe('3')
  })

  it('validates short ID check digit', () => {
    const id = generateShortId('account')
    expect(isValidShortId(id)).toBe(true)
    // tamper with check digit
    const tampered = id.slice(0, 5) + ((parseInt(id[5]) + 1) % 10).toString()
    expect(isValidShortId(tampered)).toBe(false)
  })

  it('rejects non-6-digit strings', () => {
    expect(isValidShortId('12345')).toBe(false)
    expect(isValidShortId('1234567')).toBe(false)
    expect(isValidShortId('abcdef')).toBe(false)
    expect(isValidShortId('')).toBe(false)
  })

  it('returns correct type from short ID', () => {
    expect(getShortIdType(generateShortId('account'))).toBe('account')
    expect(getShortIdType(generateShortId('email'))).toBe('email')
    expect(getShortIdType(generateShortId('api_key'))).toBe('api_key')
    expect(getShortIdType(generateShortId('note'))).toBe('note')
    expect(getShortIdType('invalid')).toBeNull()
  })

  it('generates unique IDs', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(generateShortId('account'))
    }
    // most should be unique (small chance of collision)
    expect(ids.size).toBeGreaterThan(90)
  })
})

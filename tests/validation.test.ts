import { describe, expect, it } from 'vitest'
import { MePassError } from '../src/types/entry.js'
import { validateEntry, validateField, validateShortId, validateType } from '../src/core/validation.js'

describe('validation', () => {
  it('requires account username and password', () => {
    const errors = validateEntry('account', {
      name: 'GitHub',
      username: null,
      password: null,
    })

    expect(errors).toContain('username 不能为空')
    expect(errors).toContain('password 不能为空')
  })

  it('requires api_key baseurl and apikey', () => {
    const errors = validateEntry('api_key', {
      name: 'OpenAI',
      baseurl: '',
      apikey: '',
    })

    expect(errors).toContain('baseurl 不能为空')
    expect(errors).toContain('apikey 不能为空')
  })

  it('rejects fields beyond configured max length', () => {
    const err = validateField('name', 'x'.repeat(81))
    expect(err).toBe('name 长度不能超过 80 字符')
  })

  it('accepts valid entry types and rejects invalid ones', () => {
    expect(validateType('account')).toBe('account')
    expect(validateType('email')).toBe('email')
    expect(validateType('api_key')).toBe('api_key')
    expect(validateType('note')).toBe('note')
    expect(() => validateType('token')).toThrow(MePassError)
  })

  it('rejects malformed short ids', () => {
    expect(() => validateShortId('abc123')).toThrow(MePassError)
    expect(() => validateShortId('12345')).toThrow(MePassError)
  })
})


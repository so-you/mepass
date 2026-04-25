import crypto from 'node:crypto'
import { ENTRY_TYPE_PREFIX, type EntryType, MePassError } from '../types/entry.js'

function calculateCheckDigit(digits: string): number {
  const weights = [3, 5, 7, 9, 11]
  let sum = 0
  for (let i = 0; i < 5; i++) {
    sum += parseInt(digits[i], 10) * weights[i]
  }
  return sum % 10
}

export function generateShortId(type: EntryType): string {
  const prefix = ENTRY_TYPE_PREFIX[type]
  const randomDigits = Array.from({ length: 4 }, () => crypto.randomInt(0, 10)).join('')
  const base = prefix + randomDigits
  const checkDigit = calculateCheckDigit(base)
  return base + checkDigit.toString()
}

export function isValidShortId(shortId: string): boolean {
  if (!/^\d{6}$/.test(shortId)) return false
  const expected = calculateCheckDigit(shortId.slice(0, 5))
  return parseInt(shortId[5], 10) === expected
}

export function getShortIdType(shortId: string): EntryType | null {
  if (!isValidShortId(shortId)) return null
  const prefix = shortId[0]
  for (const [type, code] of Object.entries(ENTRY_TYPE_PREFIX)) {
    if (code === prefix) return type as EntryType
  }
  return null
}

export function generateUniqueShortId(type: EntryType, existsFn: (id: string) => boolean, maxRetries = 100): string {
  for (let i = 0; i < maxRetries; i++) {
    const id = generateShortId(type)
    if (!existsFn(id)) return id
  }
  throw new MePassError('SHORT_ID_GENERATION_FAILED', '生成短 ID 失败，请重试')
}

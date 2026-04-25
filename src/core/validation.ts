import { MePassError, type EntryType } from '../types/entry.js'

type FieldRule = { required: boolean; min: number; max: number }

const RULES: Record<string, FieldRule> = {
  name: { required: true, min: 1, max: 80 },
  username: { required: false, min: 1, max: 120 },
  password: { required: false, min: 1, max: 1000 },
  baseurl: { required: false, min: 1, max: 300 },
  apikey: { required: false, min: 1, max: 4000 },
  note: { required: false, min: 1, max: 5000 },
  url: { required: false, min: 1, max: 300 },
  remark: { required: false, min: 0, max: 1000 },
}

const TYPE_REQUIRED_FIELDS: Record<EntryType, string[]> = {
  account: ['name', 'username', 'password'],
  email: ['name', 'username', 'password'],
  api_key: ['name', 'baseurl', 'apikey'],
  note: ['name', 'note'],
}

export function validateField(name: string, value: string | null | undefined): string | null {
  const rule = RULES[name]
  if (!rule) return null

  if (!value || value.length === 0) {
    if (rule.required) return `${name} 不能为空`
    return null
  }

  if (value.length < rule.min) return `${name} 长度不能少于 ${rule.min} 字符`
  if (value.length > rule.max) return `${name} 长度不能超过 ${rule.max} 字符`

  return null
}

export function validateEntry(type: EntryType, fields: Record<string, string | null>): string[] {
  const errors: string[] = []
  const requiredFields = TYPE_REQUIRED_FIELDS[type]

  for (const field of requiredFields) {
    const rule = { ...RULES[field], required: true }
    const value = fields[field]
    if (!value || value.length === 0) {
      errors.push(`${field} 不能为空`)
    } else if (value.length < rule.min) {
      errors.push(`${field} 长度不能少于 ${rule.min} 字符`)
    } else if (value.length > rule.max) {
      errors.push(`${field} 长度不能超过 ${rule.max} 字符`)
    }
  }

  for (const [field, value] of Object.entries(fields)) {
    if (requiredFields.includes(field)) continue
    const err = validateField(field, value)
    if (err) errors.push(err)
  }

  return errors
}

export function validateType(type: string): EntryType {
  const valid: EntryType[] = ['account', 'email', 'api_key', 'note']
  if (!valid.includes(type as EntryType)) {
    throw new MePassError('INVALID_TYPE', 'type 仅支持 account/email/api_key/note')
  }
  return type as EntryType
}

export function validateShortId(shortId: string): void {
  if (!/^\d{6}$/.test(shortId)) {
    throw new MePassError('SHORT_ID_INVALID', 'short_id 必须为 6 位有效数字')
  }
}

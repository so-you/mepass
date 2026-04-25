export type EntryType = 'account' | 'email' | 'api_key' | 'note'

export type EncryptedField = {
  cipher: string
  iv: string
  authTag: string
}

export type Entry = {
  id: string
  shortId: string
  type: EntryType
  name: string
  username: string | null
  passwordCipher: string | null
  passwordIv: string | null
  passwordAuthTag: string | null
  baseurl: string | null
  apikeyCipher: string | null
  apikeyIv: string | null
  apikeyAuthTag: string | null
  url: string | null
  noteCipher: string | null
  noteIv: string | null
  noteAuthTag: string | null
  remark: string | null
  tags: string
  createdAt: string
  updatedAt: string
  lastAccessedAt: string | null
}

export type EntryListItem = {
  shortId: string
  type: EntryType
  name: string
  username: string | null
  baseurl: string | null
  url: string | null
  tags: string
  updatedAt: string
}

export type NewEntry = Omit<Entry, 'id' | 'shortId' | 'createdAt' | 'updatedAt' | 'lastAccessedAt'>

export type VaultMeta = {
  schemaVersion: string
  createdAt: string
  keySource: 'system-keychain' | 'local-key-file'
  kdfAlgorithm: string
  kdfParams: string
  kdfSalt: string
  encryptedDataKeyCipher: string
  encryptedDataKeyIv: string
  encryptedDataKeyAuthTag: string
}

export type KdfParams = {
  algorithm: 'scrypt'
  keyLength: number
  N: number
  r: number
  p: number
}

export const KDF_DEFAULTS: KdfParams = {
  algorithm: 'scrypt',
  keyLength: 32,
  N: 32768,
  r: 8,
  p: 1,
}

export type KeyStoreSource = 'system-keychain' | 'local-key-file'

export type ErrorCode =
  | 'NOT_INITIALIZED'
  | 'KEY_MISSING'
  | 'INVALID_TYPE'
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'DECRYPT_FAILED'
  | 'SHORT_ID_INVALID'
  | 'SHORT_ID_GENERATION_FAILED'

export class MePassError extends Error {
  code: ErrorCode
  constructor(code: ErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'MePassError'
  }
}

export const ENTRY_TYPE_PREFIX: Record<EntryType, string> = {
  account: '0',
  email: '1',
  api_key: '2',
  note: '3',
}

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  account: '账号',
  email: '邮箱',
  api_key: 'API Key',
  note: '笔记',
}

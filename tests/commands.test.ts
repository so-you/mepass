import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import initSqlJs, { type Database } from 'sql.js'
import { SCHEMA_SQL } from '../src/db/schema.js'

import { generateDataKey, generateSalt, deriveKeyEncryptionKey, encryptDataKey, decryptDataKey } from '../src/core/crypto.js'
import { insertEntry, updateEntry, deleteEntry, getEntryByShortId, searchEntries, listEntries, getEntryCount, decryptEntryField, setMeta, getMeta, isInitialized, hasEncryptedDataKey } from '../src/db/entries-repository.js'
import { normalizeTags } from '../src/core/tags.js'
import { isValidShortId } from '../src/core/short-id.js'
import { saveDb, closeDb, resetInstance } from '../src/db/connection.js'

let db: Database
let dataKey: Buffer

beforeEach(async () => {
  const SQL = await initSqlJs()
  db = new SQL.Database()
  db.run(SCHEMA_SQL)
  dataKey = generateDataKey()
})

afterEach(() => {
  db.close()
})

describe('integration: init flow', () => {
  it('sets up vault_meta with encrypted data key', () => {
    const salt = generateSalt()
    const kek = deriveKeyEncryptionKey('test-master-password', salt)
    const encrypted = encryptDataKey(dataKey, kek)

    setMeta(db, 'schema_version', '1')
    setMeta(db, 'kdf_salt', salt.toString('base64'))
    setMeta(db, 'kdf_params', JSON.stringify({ algorithm: 'scrypt', keyLength: 32, N: 32768, r: 8, p: 1 }))
    setMeta(db, 'encrypted_data_key_cipher', encrypted.cipher)
    setMeta(db, 'encrypted_data_key_iv', encrypted.iv)
    setMeta(db, 'encrypted_data_key_auth_tag', encrypted.authTag)

    expect(isInitialized(db)).toBe(true)
    expect(hasEncryptedDataKey(db)).toBe(true)

    // Verify we can recover the data key
    const recoveredSalt = Buffer.from(getMeta(db, 'kdf_salt')!, 'base64')
    const recoveredKek = deriveKeyEncryptionKey('test-master-password', recoveredSalt)
    const recoveredKey = decryptDataKey(
      {
        cipher: getMeta(db, 'encrypted_data_key_cipher')!,
        iv: getMeta(db, 'encrypted_data_key_iv')!,
        authTag: getMeta(db, 'encrypted_data_key_auth_tag')!,
      },
      recoveredKek
    )
    expect(recoveredKey).toEqual(dataKey)
  })
})

describe('integration: add and verify', () => {
  it('adds account entry and verifies encryption', () => {
    const tags = normalizeTags('work, github', 'account')
    const shortId = insertEntry(db, 'account', {
      name: 'GitHub',
      username: 'octocat',
      passwordPlain: 'super-secret-password',
      url: 'https://github.com',
      remark: 'personal account',
      tags,
    }, dataKey)

    expect(shortId).toHaveLength(6)
    expect(isValidShortId(shortId)).toBe(true)
    expect(shortId[0]).toBe('0') // account prefix

    const entry = getEntryByShortId(db, shortId)
    expect(entry).not.toBeNull()
    expect(entry!.name).toBe('GitHub')
    expect(entry!.username).toBe('octocat')
    expect(entry!.url).toBe('https://github.com')
    expect(entry!.tags).toBe('account,github,work')

    // password is encrypted
    expect(entry!.passwordCipher).not.toBe('super-secret-password')
    expect(entry!.passwordCipher).toBeTruthy()

    // can decrypt
    const decrypted = decryptEntryField(entry!, 'password', dataKey)
    expect(decrypted).toBe('super-secret-password')
  })

  it('adds api_key entry with baseurl and apikey', () => {
    const shortId = insertEntry(db, 'api_key', {
      name: 'OpenAI',
      baseurl: 'https://api.openai.com/v1',
      apikeyPlain: 'sk-abc123456789',
      remark: 'production key',
      tags: normalizeTags('ai, openai', 'api_key'),
    }, dataKey)

    expect(shortId[0]).toBe('2') // api_key prefix

    const entry = getEntryByShortId(db, shortId)
    expect(entry!.baseurl).toBe('https://api.openai.com/v1')
    expect(entry!.apikeyCipher).not.toBe('sk-abc123456789')

    const decrypted = decryptEntryField(entry!, 'apikey', dataKey)
    expect(decrypted).toBe('sk-abc123456789')
  })

  it('adds email entry', () => {
    const shortId = insertEntry(db, 'email', {
      name: 'Gmail',
      username: 'test@gmail.com',
      passwordPlain: 'email-password',
      tags: normalizeTags('personal', 'email'),
    }, dataKey)

    expect(shortId[0]).toBe('1') // email prefix

    const entry = getEntryByShortId(db, shortId)
    expect(entry!.username).toBe('test@gmail.com')
    expect(decryptEntryField(entry!, 'password', dataKey)).toBe('email-password')
  })

  it('adds note entry', () => {
    const shortId = insertEntry(db, 'note', {
      name: 'Recovery Codes',
      notePlain: 'ABCD-1234-EFGH-5678',
      tags: normalizeTags('recovery', 'note'),
    }, dataKey)

    expect(shortId[0]).toBe('3') // note prefix

    const entry = getEntryByShortId(db, shortId)
    expect(decryptEntryField(entry!, 'note', dataKey)).toBe('ABCD-1234-EFGH-5678')
  })
})

describe('integration: list and search', () => {
  beforeEach(() => {
    insertEntry(db, 'account', {
      name: 'GitHub',
      username: 'octocat',
      passwordPlain: 'pass1',
      tags: normalizeTags('work, dev', 'account'),
    }, dataKey)
    insertEntry(db, 'email', {
      name: 'Gmail',
      username: 'test@gmail.com',
      passwordPlain: 'pass2',
      tags: normalizeTags('personal', 'email'),
    }, dataKey)
    insertEntry(db, 'api_key', {
      name: 'OpenAI',
      baseurl: 'https://api.openai.com',
      apikeyPlain: 'sk-test',
      tags: normalizeTags('ai', 'api_key'),
    }, dataKey)
  })

  it('lists all entries', () => {
    const entries = listEntries(db, {})
    expect(entries).toHaveLength(3)
  })

  it('filters by type', () => {
    const entries = listEntries(db, { type: 'email' })
    expect(entries).toHaveLength(1)
    expect(entries[0].name).toBe('Gmail')
  })

  it('filters by tag', () => {
    const entries = listEntries(db, { tag: 'work' })
    expect(entries).toHaveLength(1)
    expect(entries[0].name).toBe('GitHub')
  })

  it('searches by query', () => {
    const entries = listEntries(db, { query: 'gmail' })
    expect(entries).toHaveLength(1)
    expect(entries[0].name).toBe('Gmail')
  })

  it('searches by username', () => {
    const results = searchEntries(db, 'octocat')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('GitHub')
  })

  it('searches by baseurl', () => {
    const results = searchEntries(db, 'openai')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('OpenAI')
  })

  it('returns empty for no match', () => {
    const results = searchEntries(db, 'nonexistent')
    expect(results).toHaveLength(0)
  })
})

describe('integration: edit', () => {
  it('updates plain fields', () => {
    const shortId = insertEntry(db, 'account', {
      name: 'GitHub',
      username: 'octocat',
      passwordPlain: 'old-password',
      tags: normalizeTags('work', 'account'),
    }, dataKey)

    updateEntry(db, shortId, { name: 'GitHub Inc', username: 'newuser' }, dataKey)

    const entry = getEntryByShortId(db, shortId)
    expect(entry!.name).toBe('GitHub Inc')
    expect(entry!.username).toBe('newuser')
    // password unchanged
    expect(decryptEntryField(entry!, 'password', dataKey)).toBe('old-password')
  })

  it('re-encrypts sensitive field', () => {
    const shortId = insertEntry(db, 'account', {
      name: 'GitHub',
      username: 'octocat',
      passwordPlain: 'old-password',
      tags: normalizeTags('work', 'account'),
    }, dataKey)

    updateEntry(db, shortId, { passwordPlain: 'new-password' }, dataKey)

    const entry = getEntryByShortId(db, shortId)
    expect(decryptEntryField(entry!, 'password', dataKey)).toBe('new-password')
  })
})

describe('integration: delete', () => {
  it('deletes an entry', () => {
    const shortId = insertEntry(db, 'account', {
      name: 'GitHub',
      username: 'octocat',
      passwordPlain: 'pass',
      tags: normalizeTags('work', 'account'),
    }, dataKey)

    expect(getEntryByShortId(db, shortId)).not.toBeNull()

    const deleted = deleteEntry(db, shortId)
    expect(deleted).toBe(true)
    expect(getEntryByShortId(db, shortId)).toBeNull()
  })

  it('returns false for nonexistent entry', () => {
    expect(deleteEntry(db, '000000')).toBe(false)
  })
})

describe('integration: entry count', () => {
  it('counts entries by type', () => {
    insertEntry(db, 'account', {
      name: 'GitHub',
      username: 'octocat',
      passwordPlain: 'pass1',
      tags: normalizeTags('work', 'account'),
    }, dataKey)
    insertEntry(db, 'account', {
      name: 'Twitter',
      username: 'user1',
      passwordPlain: 'pass2',
      tags: normalizeTags('social', 'account'),
    }, dataKey)
    insertEntry(db, 'api_key', {
      name: 'OpenAI',
      baseurl: 'https://api.openai.com',
      apikeyPlain: 'sk-test',
      tags: normalizeTags('ai', 'api_key'),
    }, dataKey)

    const counts = getEntryCount(db)
    expect(counts.total).toBe(3)
    expect(counts.byType.account).toBe(2)
    expect(counts.byType.api_key).toBe(1)
    expect(counts.byType.email).toBe(0)
  })
})

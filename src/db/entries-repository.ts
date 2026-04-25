import { Database, type SqlValue } from 'sql.js'
import { v4 as uuidv4 } from 'uuid'
import type { Entry, EntryType, EntryListItem, EncryptedField } from '../types/entry.js'
import { generateUniqueShortId, isValidShortId } from '../core/short-id.js'
import { encryptText, decryptText } from '../core/crypto.js'
import { saveDb } from './connection.js'

function rowToEntry(row: Record<string, unknown>): Entry {
  return {
    id: row.id as string,
    shortId: row.short_id as string,
    type: row.type as EntryType,
    name: row.name as string,
    username: (row.username as string) || null,
    passwordCipher: (row.password_cipher as string) || null,
    passwordIv: (row.password_iv as string) || null,
    passwordAuthTag: (row.password_auth_tag as string) || null,
    baseurl: (row.baseurl as string) || null,
    apikeyCipher: (row.apikey_cipher as string) || null,
    apikeyIv: (row.apikey_iv as string) || null,
    apikeyAuthTag: (row.apikey_auth_tag as string) || null,
    url: (row.url as string) || null,
    noteCipher: (row.note_cipher as string) || null,
    noteIv: (row.note_iv as string) || null,
    noteAuthTag: (row.note_auth_tag as string) || null,
    remark: (row.remark as string) || null,
    tags: (row.tags as string) || '',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    lastAccessedAt: (row.last_accessed_at as string) || null,
  }
}

export function insertEntry(
  db: Database,
  type: EntryType,
  fields: {
    name: string
    username?: string | null
    passwordPlain?: string | null
    baseurl?: string | null
    apikeyPlain?: string | null
    url?: string | null
    notePlain?: string | null
    remark?: string | null
    tags: string
  },
  dataKey: Buffer
): string {
  const id = uuidv4()
  const shortId = generateUniqueShortId(type, (sid) => {
    const rows = db.exec('SELECT 1 FROM entries WHERE short_id = ?', [sid])
    return rows.length > 0 && (rows[0]?.values?.length ?? 0) > 0
  })

  const now = new Date().toISOString()
  const encField = (plain: string | null | undefined): EncryptedField | null => {
    if (!plain) return null
    return encryptText(plain, dataKey)
  }

  const passwordEnc = encField(fields.passwordPlain)
  const apikeyEnc = encField(fields.apikeyPlain)
  const noteEnc = encField(fields.notePlain)

  db.run(
    `INSERT INTO entries (id, short_id, type, name, username, password_cipher, password_iv, password_auth_tag,
      baseurl, apikey_cipher, apikey_iv, apikey_auth_tag, url, note_cipher, note_iv, note_auth_tag,
      remark, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, shortId, type, fields.name, fields.username || null,
      passwordEnc?.cipher ?? null, passwordEnc?.iv ?? null, passwordEnc?.authTag ?? null,
      fields.baseurl || null,
      apikeyEnc?.cipher ?? null, apikeyEnc?.iv ?? null, apikeyEnc?.authTag ?? null,
      fields.url || null,
      noteEnc?.cipher ?? null, noteEnc?.iv ?? null, noteEnc?.authTag ?? null,
      fields.remark || null, fields.tags, now, now,
    ]
  )
  saveDb()
  return shortId
}

export function updateEntry(
  db: Database,
  shortId: string,
  fields: {
    name?: string
    username?: string | null
    passwordPlain?: string | null
    baseurl?: string | null
    apikeyPlain?: string | null
    url?: string | null
    notePlain?: string | null
    remark?: string | null
    tags?: string
  },
  dataKey: Buffer
): boolean {
  const entry = getEntryByShortId(db, shortId)
  if (!entry) return false

  const now = new Date().toISOString()
  const sets: string[] = ['updated_at = ?']
  const values: SqlValue[] = [now]

  const addPlain = (col: string, val: string | null | undefined, current: string | null) => {
    if (val === undefined) return
    sets.push(`${col} = ?`)
    values.push(val ?? current)
  }

  addPlain('name', fields.name, entry.name)
  addPlain('username', fields.username, entry.username)
  addPlain('baseurl', fields.baseurl, entry.baseurl)
  addPlain('url', fields.url, entry.url)
  addPlain('remark', fields.remark, entry.remark)

  if (fields.tags !== undefined) {
    sets.push('tags = ?')
    values.push(fields.tags)
  }

  const addEncrypted = (
    colCipher: string, colIv: string, colTag: string,
    plainVal: string | null | undefined,
    currentCipher: string | null, currentIv: string | null, currentTag: string | null
  ) => {
    if (plainVal === undefined) return
    if (plainVal === null || plainVal === '') {
      sets.push(`${colCipher} = NULL`, `${colIv} = NULL`, `${colTag} = NULL`)
    } else {
      const enc = encryptText(plainVal, dataKey)
      sets.push(`${colCipher} = ?`, `${colIv} = ?`, `${colTag} = ?`)
      values.push(enc.cipher, enc.iv, enc.authTag)
    }
  }

  addEncrypted('password_cipher', 'password_iv', 'password_auth_tag',
    fields.passwordPlain, entry.passwordCipher, entry.passwordIv, entry.passwordAuthTag)
  addEncrypted('apikey_cipher', 'apikey_iv', 'apikey_auth_tag',
    fields.apikeyPlain, entry.apikeyCipher, entry.apikeyIv, entry.apikeyAuthTag)
  addEncrypted('note_cipher', 'note_iv', 'note_auth_tag',
    fields.notePlain, entry.noteCipher, entry.noteIv, entry.noteAuthTag)

  values.push(shortId)
  db.run(`UPDATE entries SET ${sets.join(', ')} WHERE short_id = ?`, values)
  saveDb()
  return true
}

export function getEntryByShortId(db: Database, shortId: string): Entry | null {
  const rows = db.exec('SELECT * FROM entries WHERE short_id = ?', [shortId])
  if (rows.length === 0 || rows[0].values.length === 0) return null
  const columns = rows[0].columns
  const values = rows[0].values[0]
  const obj: Record<string, unknown> = {}
  columns.forEach((col, i) => { obj[col] = values[i] })
  return rowToEntry(obj)
}

export function searchEntries(db: Database, query: string, type?: EntryType): Entry[] {
  let sql = `SELECT * FROM entries WHERE (
    name LIKE ? OR username LIKE ? OR baseurl LIKE ? OR url LIKE ? OR remark LIKE ? OR tags LIKE ?
  )`
  const params: SqlValue[] = [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`]

  if (type) {
    sql += ' AND type = ?'
    params.push(type)
  }

  sql += ' ORDER BY updated_at DESC'

  const rows = db.exec(sql, params)
  if (rows.length === 0) return []
  const columns = rows[0].columns
  return rows[0].values.map((vals: SqlJsValueArray) => {
    const obj: Record<string, unknown> = {}
    columns.forEach((col: string, i: number) => { obj[col] = vals[i] })
    return rowToEntry(obj)
  })
}

type SqlJsValueArray = Array<unknown>

export function listEntries(
  db: Database,
  options: { type?: EntryType; tag?: string; query?: string; limit?: number; offset?: number }
): EntryListItem[] {
  let sql = `SELECT short_id, type, name, username, baseurl, url, tags, updated_at FROM entries WHERE 1 = 1`
  const params: SqlValue[] = []

  if (options.type) {
    sql += ' AND type = ?'
    params.push(options.type)
  }

  if (options.tag) {
    const tag = options.tag.toLowerCase()
    sql += ` AND (tags = ? OR tags LIKE ? OR tags LIKE ? OR tags LIKE ?)`
    params.push(tag, `${tag},%`, `%,${tag},%`, `%,${tag}`)
  }

  if (options.query) {
    sql += ` AND (name LIKE ? OR username LIKE ? OR baseurl LIKE ? OR url LIKE ? OR remark LIKE ? OR tags LIKE ?)`
    params.push(`%${options.query}%`, `%${options.query}%`, `%${options.query}%`, `%${options.query}%`, `%${options.query}%`, `%${options.query}%`)
  }

  sql += ' ORDER BY updated_at DESC'

  const limit = options.limit ?? 50
  const offset = options.offset ?? 0
  sql += ' LIMIT ? OFFSET ?'
  params.push(limit, offset)

  const rows = db.exec(sql, params)
  if (rows.length === 0) return []
  const columns = rows[0].columns
  return rows[0].values.map((vals: SqlJsValueArray) => {
    const obj: Record<string, unknown> = {}
    columns.forEach((col: string, i: number) => { obj[col] = vals[i] })
    return {
      shortId: obj.short_id as string,
      type: obj.type as EntryType,
      name: obj.name as string,
      username: (obj.username as string) || null,
      baseurl: (obj.baseurl as string) || null,
      url: (obj.url as string) || null,
      tags: (obj.tags as string) || '',
      updatedAt: obj.updated_at as string,
    }
  })
}

export function deleteEntry(db: Database, shortId: string): boolean {
  const rows = db.exec('SELECT 1 FROM entries WHERE short_id = ?', [shortId])
  if (rows.length === 0 || rows[0].values.length === 0) return false
  db.run('DELETE FROM entries WHERE short_id = ?', [shortId])
  saveDb()
  return true
}

export function updateLastAccessed(db: Database, shortId: string): void {
  db.run('UPDATE entries SET last_accessed_at = ? WHERE short_id = ?', [new Date().toISOString(), shortId])
  saveDb()
}

export function getEntryCount(db: Database): { total: number; byType: Record<string, number> } {
  const totalRows = db.exec('SELECT COUNT(*) FROM entries')
  const total = totalRows.length > 0 && totalRows[0].values.length > 0
    ? (totalRows[0].values[0][0] as number)
    : 0

  const byType: Record<string, number> = { account: 0, email: 0, api_key: 0, note: 0 }
  const typeRows = db.exec('SELECT type, COUNT(*) as cnt FROM entries GROUP BY type')
  if (typeRows.length > 0) {
    for (const row of typeRows[0].values) {
      byType[row[0] as string] = row[1] as number
    }
  }

  return { total, byType }
}

export function decryptEntryField(entry: Entry, fieldName: 'password' | 'apikey' | 'note', dataKey: Buffer): string | null {
  let field: EncryptedField | null = null
  if (fieldName === 'password' && entry.passwordCipher && entry.passwordIv && entry.passwordAuthTag) {
    field = { cipher: entry.passwordCipher, iv: entry.passwordIv, authTag: entry.passwordAuthTag }
  } else if (fieldName === 'apikey' && entry.apikeyCipher && entry.apikeyIv && entry.apikeyAuthTag) {
    field = { cipher: entry.apikeyCipher, iv: entry.apikeyIv, authTag: entry.apikeyAuthTag }
  } else if (fieldName === 'note' && entry.noteCipher && entry.noteIv && entry.noteAuthTag) {
    field = { cipher: entry.noteCipher, iv: entry.noteIv, authTag: entry.noteAuthTag }
  }
  if (!field) return null
  try {
    return decryptText(field, dataKey)
  } catch {
    throw new Error('DECRYPT_FAILED')
  }
}

export function setMeta(db: Database, key: string, value: string): void {
  db.run('INSERT OR REPLACE INTO vault_meta (key, value) VALUES (?, ?)', [key, value])
  saveDb()
}

export function getMeta(db: Database, key: string): string | null {
  const rows = db.exec('SELECT value FROM vault_meta WHERE key = ?', [key])
  if (rows.length === 0 || rows[0].values.length === 0) return null
  return rows[0].values[0][0] as string
}

export function isInitialized(db: Database): boolean {
  const rows = db.exec("SELECT 1 FROM vault_meta WHERE key = 'schema_version'")
  return rows.length > 0 && rows[0].values.length > 0
}

export function hasEncryptedDataKey(db: Database): boolean {
  const rows = db.exec("SELECT 1 FROM vault_meta WHERE key = 'encrypted_data_key_cipher'")
  return rows.length > 0 && rows[0].values.length > 0
}

import { beforeEach, describe, expect, it } from 'vitest'
import initSqlJs, { type Database } from 'sql.js'
import { SCHEMA_SQL } from '../src/db/schema.js'
import { generateDataKey } from '../src/core/crypto.js'
import { insertEntry, listEntries, searchEntries } from '../src/db/entries-repository.js'
import { normalizeTags } from '../src/core/tags.js'

let db: Database
let dataKey: Buffer

beforeEach(async () => {
  const SQL = await initSqlJs()
  db = new SQL.Database()
  db.run(SCHEMA_SQL)
  dataKey = generateDataKey()

  insertEntry(db, 'account', {
    name: 'GitHub',
    username: 'octocat',
    passwordPlain: 'pass1',
    tags: normalizeTags('work,dev', 'account'),
  }, dataKey)
  insertEntry(db, 'email', {
    name: 'Gmail',
    username: 'octocat@gmail.com',
    passwordPlain: 'pass2',
    tags: normalizeTags('mail,personal', 'email'),
  }, dataKey)
  insertEntry(db, 'api_key', {
    name: 'OpenAI',
    baseurl: 'https://api.openai.com',
    apikeyPlain: 'sk-test',
    tags: normalizeTags('ai,work', 'api_key'),
  }, dataKey)
})

describe('entries repository query behavior', () => {
  it('searches plaintext username and can filter by type', () => {
    const all = searchEntries(db, 'octocat')
    expect(all.map(e => e.type).sort()).toEqual(['account', 'email'])

    const onlyEmail = searchEntries(db, 'octocat', 'email')
    expect(onlyEmail).toHaveLength(1)
    expect(onlyEmail[0].name).toBe('Gmail')
  })

  it('matches comma-separated tags by token boundary', () => {
    const work = listEntries(db, { tag: 'work' })
    expect(work.map(e => e.name).sort()).toEqual(['GitHub', 'OpenAI'])

    const partial = listEntries(db, { tag: 'or' })
    expect(partial).toHaveLength(0)
  })

  it('applies limit and offset consistently', () => {
    const first = listEntries(db, { limit: 1, offset: 0 })
    const second = listEntries(db, { limit: 1, offset: 1 })

    expect(first).toHaveLength(1)
    expect(second).toHaveLength(1)
    expect(first[0].shortId).not.toBe(second[0].shortId)
  })
})


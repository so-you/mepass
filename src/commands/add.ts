import { input } from '@inquirer/prompts'
import { getDb } from '../db/connection.js'
import { ensureDataKey } from './ensure-key.js'
import { insertEntry } from '../db/entries-repository.js'
import { normalizeTags } from '../core/tags.js'
import { validateEntry, validateType } from '../core/validation.js'
import { MePassError, type EntryType } from '../types/entry.js'

export async function addCommand(typeStr: string): Promise<void> {
  const type = validateType(typeStr)
  const { db, dataKey } = await ensureKeyForCommand()

  let fields: Record<string, string | null>

  switch (type) {
    case 'account':
    case 'email':
      fields = await collectAccountFields(type)
      break
    case 'api_key':
      fields = await collectApiKeyFields()
      break
    case 'note':
      fields = await collectNoteFields()
      break
  }

  const errors = validateEntry(type, fields)
  if (errors.length > 0) {
    console.log('输入校验失败：')
    errors.forEach(e => console.log(`  - ${e}`))
    return
  }

  const tags = normalizeTags(fields.tags ?? undefined, type)
  const shortId = insertEntry(db, type, {
    name: fields.name!,
    username: fields.username,
    passwordPlain: fields.password,
    baseurl: fields.baseurl,
    apikeyPlain: fields.apikey,
    url: fields.url,
    notePlain: fields.note,
    remark: fields.remark,
    tags,
  }, dataKey)

  console.log(`已添加 (${type})，short_id: ${shortId}`)
}

async function collectAccountFields(type: EntryType): Promise<Record<string, string | null>> {
  const name = await input({ message: `名称（平台/服务名）` })
  const username = await input({ message: '用户名/邮箱' })
  const pwd = await input({ message: '密码' })
  const url = await input({ message: '网址（可选，回车跳过）' })
  const remark = await input({ message: '备注（可选，回车跳过）' })
  const tags = await input({ message: '标签（可选，逗号分隔，回车跳过）' })
  return {
    name: name || null,
    username: username || null,
    password: pwd || null,
    url: url || null,
    remark: remark || null,
    tags: tags || null,
  }
}

async function collectApiKeyFields(): Promise<Record<string, string | null>> {
  const name = await input({ message: '名称（服务名）' })
  const baseurl = await input({ message: 'Base URL' })
  const apikey = await input({ message: 'API Key' })
  const remark = await input({ message: '备注（可选，回车跳过）' })
  const tags = await input({ message: '标签（可选，逗号分隔，回车跳过）' })
  return {
    name: name || null,
    baseurl: baseurl || null,
    apikey: apikey || null,
    remark: remark || null,
    tags: tags || null,
  }
}

async function collectNoteFields(): Promise<Record<string, string | null>> {
  const name = await input({ message: '名称' })
  const note = await input({ message: '笔记内容' })
  const remark = await input({ message: '备注（可选，回车跳过）' })
  const tags = await input({ message: '标签（可选，逗号分隔，回车跳过）' })
  return {
    name: name || null,
    note: note || null,
    remark: remark || null,
    tags: tags || null,
  }
}

async function ensureKeyForCommand(): Promise<{ db: Awaited<ReturnType<typeof getDb>>; dataKey: Buffer }> {
  const db = await getDb()
  const result = await ensureDataKey(db)
  if (!result) {
    throw new MePassError('NOT_INITIALIZED', '请先执行 mepass init')
  }
  return { db, dataKey: result.dataKey }
}

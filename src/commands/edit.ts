import { input, password } from '@inquirer/prompts'
import { getDb } from '../db/connection.js'
import { requireMasterPassword } from './ensure-key.js'
import { getEntryByShortId, updateEntry, isInitialized } from '../db/entries-repository.js'
import { normalizeTags } from '../core/tags.js'
import { isValidShortId } from '../core/short-id.js'
import { MePassError, ENTRY_TYPE_LABELS, type EntryType } from '../types/entry.js'

export async function editCommand(shortId: string): Promise<void> {
  if (!isValidShortId(shortId)) {
    throw new MePassError('SHORT_ID_INVALID', 'short_id 必须为 6 位有效数字')
  }

  const db = await getDb()
  if (!isInitialized(db)) {
    throw new MePassError('NOT_INITIALIZED', '请先执行 mepass init')
  }

  const entry = getEntryByShortId(db, shortId)
  if (!entry) {
    throw new MePassError('NOT_FOUND', `未找到 short_id: ${shortId}`)
  }

  const dataKey = await requireMasterPassword(db)

  console.log(`\n编辑记录 [${entry.shortId}] ${ENTRY_TYPE_LABELS[entry.type]} - ${entry.name}`)
  console.log('提示：直接回车保留原值\n')

  const type = entry.type as EntryType
  const fields: Record<string, string | null | undefined> = {}

  fields.name = await input({ message: `名称 [${entry.name}]` }) || undefined
  fields.remark = await input({ message: `备注 [${entry.remark || ''}]` }) || undefined

  if (type === 'account' || type === 'email') {
    fields.username = await input({ message: `用户名 [${entry.username || ''}]` }) || undefined
    fields.passwordPlain = await password({ message: '新密码（回车保留原密码）', mask: '*' }) || undefined
    fields.url = await input({ message: `URL [${entry.url || ''}]` }) || undefined
  } else if (type === 'api_key') {
    fields.baseurl = await input({ message: `Base URL [${entry.baseurl || ''}]` }) || undefined
    fields.apikeyPlain = await password({ message: '新 API Key（回车保留原值）', mask: '*' }) || undefined
  } else if (type === 'note') {
    fields.notePlain = await input({ message: '新笔记内容（回车保留原值）' }) || undefined
  }

  const tagsInput = await input({ message: `标签 [${entry.tags}]` })
  if (tagsInput) {
    fields.tags = normalizeTags(tagsInput, type)
  }

  updateEntry(db, shortId, fields as Parameters<typeof updateEntry>[2], dataKey)
  console.log(`记录 ${shortId} 已更新。`)
}

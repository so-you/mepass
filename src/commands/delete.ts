import { input } from '@inquirer/prompts'
import { getDb } from '../db/connection.js'
import { getEntryByShortId, deleteEntry, isInitialized } from '../db/entries-repository.js'
import { isValidShortId } from '../core/short-id.js'
import { MePassError, ENTRY_TYPE_LABELS } from '../types/entry.js'
import { requireMasterPassword } from './ensure-key.js'

export async function deleteCommand(shortId: string): Promise<void> {
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

  console.log('')
  console.log(`  Short ID: ${entry.shortId}`)
  console.log(`  类型: ${ENTRY_TYPE_LABELS[entry.type]}`)
  console.log(`  名称: ${entry.name}`)
  if (entry.username) console.log(`  用户名: ${entry.username}`)
  if (entry.baseurl) console.log(`  Base URL: ${entry.baseurl}`)
  console.log(`  标签: ${entry.tags}`)
  console.log('')

  await requireMasterPassword(db)

  const confirmation = await input({ message: '确认删除？输入 yes 确认' })
  if (confirmation.toLowerCase() !== 'yes') {
    console.log('已取消。')
    return
  }

  deleteEntry(db, shortId)
  console.log(`记录 ${shortId} 已删除。`)
}

import { getDb } from '../db/connection.js'
import { getDataDir, getDbPath, getConfigPath } from '../platform/paths.js'
import { getSource } from '../core/key-store.js'
import { getEntryCount, getMeta, isInitialized } from '../db/entries-repository.js'
import { ENTRY_TYPE_LABELS } from '../types/entry.js'

export async function statusCommand(): Promise<void> {
  console.log('')
  console.log(`  数据目录：${getDataDir()}`)
  console.log(`  数据库路径：${getDbPath()}`)
  console.log(`  配置路径：${getConfigPath()}`)

  const db = await getDb()

  if (!isInitialized(db)) {
    console.log('  状态：未初始化')
    console.log('')
    console.log('  请先执行 mepass init')
    return
  }

  const keySource = await getSource()
  const keySourceLabel = keySource === 'system-keychain' ? '系统钥匙串' : '本地密钥文件'
  console.log(`  密钥来源：${keySourceLabel}`)

  const counts = getEntryCount(db)
  console.log(`  总记录数：${counts.total}`)

  for (const [type, count] of Object.entries(counts.byType)) {
    if (count > 0) {
      console.log(`    ${ENTRY_TYPE_LABELS[type as keyof typeof ENTRY_TYPE_LABELS] || type}: ${count}`)
    }
  }

  console.log('')
}

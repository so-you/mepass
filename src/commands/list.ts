import { getDb } from '../db/connection.js'
import { listEntries } from '../db/entries-repository.js'
import { isInitialized } from '../db/entries-repository.js'
import { MePassError, ENTRY_TYPE_LABELS, type EntryType } from '../types/entry.js'
import { validateType } from '../core/validation.js'
import Table from 'cli-table3'

export async function listCommand(options: {
  type?: string
  tag?: string
  query?: string
  json?: boolean
  limit?: number
  offset?: number
}): Promise<void> {
  const db = await getDb()
  if (!isInitialized(db)) {
    throw new MePassError('NOT_INITIALIZED', '请先执行 mepass init')
  }

  if (options.type) {
    validateType(options.type)
  }

  const entries = listEntries(db, {
    type: options.type as EntryType | undefined,
    tag: options.tag,
    query: options.query,
    limit: options.limit,
    offset: options.offset,
  })

  if (entries.length === 0) {
    console.log('没有匹配的记录。')
    return
  }

  if (options.json) {
    console.log(JSON.stringify(entries, null, 2))
    return
  }

  const table = new Table({
    head: ['Short ID', '类型', '名称', '用户名', 'Base URL', 'URL', '标签', '更新时间'],
    colWidths: [10, 10, 20, 20, 25, 25, 20, 20],
    wordWrap: true,
  })

  for (const e of entries) {
    table.push([
      e.shortId,
      ENTRY_TYPE_LABELS[e.type] || e.type,
      e.name,
      e.username || '',
      e.baseurl || '',
      e.url || '',
      e.tags,
      formatTime(e.updatedAt),
    ])
  }

  console.log(table.toString())
  console.log(`共 ${entries.length} 条记录`)
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

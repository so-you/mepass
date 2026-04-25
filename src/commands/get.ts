import { getDb } from '../db/connection.js'
import type { Database } from 'sql.js'
import { ensureDataKey } from './ensure-key.js'
import { getEntryByShortId, searchEntries, updateLastAccessed, decryptEntryField } from '../db/entries-repository.js'
import { isValidShortId } from '../core/short-id.js'
import { copyToClipboard } from '../platform/clipboard.js'
import { MePassError, ENTRY_TYPE_LABELS, type EntryType, type Entry } from '../types/entry.js'
import { isInitialized } from '../db/entries-repository.js'
import Table from 'cli-table3'

export async function getCommand(
  query: string,
  options: {
    type?: string
    reveal?: boolean
    copy?: string
    json?: boolean
  }
): Promise<void> {
  const db = await getDb()
  if (!isInitialized(db)) {
    throw new MePassError('NOT_INITIALIZED', '请先执行 mepass init')
  }

  let entry: Entry | null = null

  if (isValidShortId(query)) {
    entry = getEntryByShortId(db, query)
    if (entry && options.type && entry.type !== options.type) {
      entry = null
    }
  }

  if (!entry) {
    const results = searchEntries(db, query, options.type as EntryType | undefined)
    if (results.length === 0) {
      throw new MePassError('NOT_FOUND', '未找到匹配记录')
    }
    if (results.length === 1) {
      entry = results[0]
    } else {
      // 多条结果：用表格展示
      showResultsTable(results)
      return
    }
  }

  if (!entry) {
    throw new MePassError('NOT_FOUND', '未找到匹配记录')
  }

  updateLastAccessed(db, entry.shortId)

  if (options.copy) {
    const { dataKey } = (await ensureDataKey(db))!
    const field = options.copy as 'password' | 'apikey' | 'note'
    const plain = decryptField(entry, field, dataKey)
    if (plain) {
      await copyToClipboard(plain)
      console.log(`✓ ${field} 已复制到剪贴板（60秒后自动清除）`)
    } else {
      console.log(`该记录没有 ${field} 字段`)
    }
    return
  }

  if (options.json) {
    const { dataKey } = (await ensureDataKey(db))!
    const output: Record<string, unknown> = {
      shortId: entry.shortId,
      type: entry.type,
      name: entry.name,
      username: entry.username,
      baseurl: entry.baseurl,
      url: entry.url,
      remark: entry.remark,
      tags: entry.tags,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      lastAccessedAt: entry.lastAccessedAt,
    }
    output.password = decryptField(entry, 'password', dataKey)
    output.apikey = decryptField(entry, 'apikey', dataKey)
    output.note = decryptField(entry, 'note', dataKey)
    console.log(JSON.stringify(output, null, 2))
    return
  }

  // 单条结果：明文展示所有字段（含敏感字段）
  showEntryTable(entry, db)
}

async function showEntryTable(entry: Entry, db: Database): Promise<void> {
  const { dataKey } = (await ensureDataKey(db))!

  const rows: string[][] = []

  rows.push(['Short ID', entry.shortId])
  rows.push(['类型', ENTRY_TYPE_LABELS[entry.type]])
  rows.push(['名称', entry.name])
  if (entry.username) rows.push(['用户名', entry.username])
  if (entry.baseurl) rows.push(['Base URL', entry.baseurl])
  if (entry.url) rows.push(['URL', entry.url])

  // 敏感字段明文显示
  const pwd = decryptField(entry, 'password', dataKey)
  if (pwd) rows.push(['密码', pwd])

  const apikey = decryptField(entry, 'apikey', dataKey)
  if (apikey) rows.push(['API Key', apikey])

  const note = decryptField(entry, 'note', dataKey)
  if (note) rows.push(['笔记', note])

  if (entry.remark) rows.push(['备注', entry.remark])
  rows.push(['标签', entry.tags])
  rows.push(['更新时间', formatTime(entry.updatedAt)])

  const table = new Table({
    head: ['字段', '值'],
    colWidths: [15, 60],
    wordWrap: true,
  })

  for (const [field, value] of rows) {
    table.push([field, value])
  }

  console.log('')
  console.log(table.toString())
  console.log('')
  console.log('提示: 使用 --copy <字段> 复制敏感字段到剪贴板')
}

function showResultsTable(entries: Entry[]): void {
  const table = new Table({
    head: ['#', 'Short ID', '类型', '名称', '用户名', 'Base URL', '标签'],
    colWidths: [4, 10, 10, 20, 20, 25, 25],
    wordWrap: true,
  })

  entries.forEach((e, i) => {
    table.push([
      (i + 1).toString(),
      e.shortId,
      ENTRY_TYPE_LABELS[e.type],
      e.name,
      e.username || '',
      e.baseurl || '',
      e.tags,
    ])
  })

  console.log('')
  console.log(`找到 ${entries.length} 条匹配记录：`)
  console.log(table.toString())
  console.log('')
  console.log('使用 mepass get <short_id> 查看指定记录详情')
}

function decryptField(entry: Entry, field: 'password' | 'apikey' | 'note', dataKey: Buffer): string | null {
  try {
    return decryptEntryField(entry, field, dataKey)
  } catch {
    throw new MePassError('DECRYPT_FAILED', '敏感字段解密失败，请检查密钥是否匹配')
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

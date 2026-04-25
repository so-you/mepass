import { select } from '@inquirer/prompts'
import { getDb } from '../db/connection.js'
import { ensureDataKey } from './ensure-key.js'
import { getEntryByShortId, searchEntries, updateLastAccessed, decryptEntryField } from '../db/entries-repository.js'
import { isValidShortId } from '../core/short-id.js'
import { copyToClipboard } from '../platform/clipboard.js'
import { MePassError, ENTRY_TYPE_LABELS, type EntryType, type Entry } from '../types/entry.js'
import { isInitialized } from '../db/entries-repository.js'

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
      const choices = results.map(e => ({
        name: `[${e.shortId}] ${ENTRY_TYPE_LABELS[e.type]} ${e.name} ${e.username || e.baseurl || ''} ${e.tags}`,
        value: e.shortId,
      }))
      const selected = await select({ message: '找到多条记录，请选择：', choices })
      entry = getEntryByShortId(db, selected)
    }
  }

  if (!entry) {
    throw new MePassError('NOT_FOUND', '未找到匹配记录')
  }

  updateLastAccessed(db, entry.shortId)

  if (options.json) {
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

    if (options.reveal || options.copy) {
      const { dataKey } = (await ensureDataKey(db))!
      if (options.reveal) {
        output.password = decryptField(entry, 'password', dataKey)
        output.apikey = decryptField(entry, 'apikey', dataKey)
        output.note = decryptField(entry, 'note', dataKey)
      }
      if (options.copy) {
        const plain = decryptField(entry, options.copy as 'password' | 'apikey' | 'note', dataKey)
        if (plain) {
          await copyToClipboard(plain)
          output[`${options.copy}Copied`] = true
        }
      }
    } else {
      output.password = entry.passwordCipher ? '••••••' : null
      output.apikey = entry.apikeyCipher ? '••••••' : null
      output.note = entry.noteCipher ? '••••••' : null
    }

    console.log(JSON.stringify(output, null, 2))
    return
  }

  console.log('')
  console.log(`  Short ID: ${entry.shortId}`)
  console.log(`  类型: ${ENTRY_TYPE_LABELS[entry.type]}`)
  console.log(`  名称: ${entry.name}`)
  if (entry.username) console.log(`  用户名: ${entry.username}`)
  if (entry.baseurl) console.log(`  Base URL: ${entry.baseurl}`)
  if (entry.url) console.log(`  URL: ${entry.url}`)
  if (entry.remark) console.log(`  备注: ${entry.remark}`)
  console.log(`  标签: ${entry.tags}`)

  if (options.reveal || options.copy) {
    const { dataKey } = (await ensureDataKey(db))!

    if (options.reveal) {
      const pwd = decryptField(entry, 'password', dataKey)
      const apikey = decryptField(entry, 'apikey', dataKey)
      const note = decryptField(entry, 'note', dataKey)
      if (pwd) console.log(`  密码: ${pwd}`)
      if (apikey) console.log(`  API Key: ${apikey}`)
      if (note) console.log(`  笔记: ${note}`)
    }

    if (options.copy) {
      const plain = decryptField(entry, options.copy as 'password' | 'apikey' | 'note', dataKey)
      if (plain) {
        await copyToClipboard(plain)
        console.log(`  ✓ ${options.copy} 已复制到剪贴板（60秒后自动清除）`)
      } else {
        console.log(`  该记录没有 ${options.copy} 字段`)
      }
    }
  } else {
    if (entry.passwordCipher) console.log('  密码: ••••••')
    if (entry.apikeyCipher) console.log('  API Key: ••••••')
    if (entry.noteCipher) console.log('  笔记: ••••••')
  }

  console.log(`  更新时间: ${formatTime(entry.updatedAt)}`)
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

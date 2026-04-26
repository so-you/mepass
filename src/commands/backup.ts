import fs from 'node:fs'
import path from 'node:path'
import { getDbPath, getDataDir } from '../platform/paths.js'
import { MePassError } from '../types/entry.js'

export async function backupCommand(): Promise<void> {
  const dbPath = getDbPath()

  if (!fs.existsSync(dbPath)) {
    throw new MePassError('NOT_INITIALIZED', '数据库不存在，请先执行 mepass init')
  }

  const today = new Date().toISOString().slice(0, 10)
  const backupPath = path.join(getDataDir(), `mepass-${today}.db`)

  fs.copyFileSync(dbPath, backupPath)

  console.log(`备份完成: ${backupPath}`)
}

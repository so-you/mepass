import initSqlJs, { Database } from 'sql.js'
import fs from 'node:fs'
import path from 'node:path'
import { getDbPath, ensureDataDir } from '../platform/paths.js'
import { SCHEMA_SQL } from './schema.sql.js'

let dbInstance: Database | null = null
let dbPath: string | null = null

export async function getDb(customPath?: string): Promise<Database> {
  if (dbInstance) return dbInstance

  dbPath = customPath || getDbPath()
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const SQL = await initSqlJs()

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath)
    dbInstance = new SQL.Database(buffer)
  } else {
    dbInstance = new SQL.Database()
  }

  dbInstance.run(SCHEMA_SQL)
  saveDb()

  return dbInstance
}

export function saveDb(): void {
  if (!dbInstance || !dbPath) return
  const data = dbInstance.export()
  fs.writeFileSync(dbPath, Buffer.from(data))
}

export function closeDb(): void {
  if (dbInstance) {
    saveDb()
    dbInstance.close()
    dbInstance = null
    dbPath = null
  }
}

export function resetInstance(): void {
  dbInstance = null
  dbPath = null
}

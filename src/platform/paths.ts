import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

function getDataDir(): string {
  const platform = process.platform
  switch (platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'mePass')
    case 'linux':
      return path.join(os.homedir(), '.local', 'share', 'mepass')
    case 'win32':
      return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'mePass')
    default:
      return path.join(os.homedir(), '.mepass')
  }
}

function ensureDataDir(): string {
  const dir = getDataDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function getDbPath(): string {
  return path.join(getDataDir(), 'mepass.db')
}

export function getConfigPath(): string {
  return path.join(getDataDir(), 'config.json')
}

export function getVaultKeyPath(): string {
  return path.join(getDataDir(), 'vault.key')
}

export { getDataDir, ensureDataDir }

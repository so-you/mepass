import { execSync } from 'node:child_process'
import fs from 'node:fs'
import { getVaultKeyPath, getConfigPath, ensureDataDir } from '../platform/paths.js'
import type { KeyStoreSource } from '../types/entry.js'

const SERVICE_NAME = 'mePass'
const ACCOUNT_NAME = 'default-vault-key'

function isMacos(): boolean {
  return process.platform === 'darwin'
}

function isLinux(): boolean {
  return process.platform === 'linux'
}

function isWindows(): boolean {
  return process.platform === 'win32'
}

function saveToSystemKeychain(key: Buffer): boolean {
  try {
    const encoded = key.toString('base64')
    if (isMacos()) {
      execSync(`security add-generic-password -s "${SERVICE_NAME}" -a "${ACCOUNT_NAME}" -w "${encoded}" -U`, {
        stdio: 'pipe',
      })
      return true
    }
    if (isLinux()) {
      execSync(`secret-tool store --label="${SERVICE_NAME}" service "${SERVICE_NAME}" account "${ACCOUNT_NAME}"`, {
        input: encoded,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      return true
    }
    if (isWindows()) {
      const ps = `$sec = ConvertTo-SecureString "${encoded}" -AsPlainText -Force; New-Object System.Management.Automation.PSCredential("${ACCOUNT_NAME}", $sec) | Export-CliXml -Path "${getConfigPath().replace('config.json', 'mepass-credential.xml')}" `
      execSync(`powershell -Command "${ps}"`, { stdio: 'pipe' })
      return true
    }
    return false
  } catch {
    return false
  }
}

function readFromSystemKeychain(): Buffer | null {
  try {
    let encoded: string | null = null
    if (isMacos()) {
      const result = execSync(`security find-generic-password -s "${SERVICE_NAME}" -a "${ACCOUNT_NAME}" -w`, {
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf8',
      })
      encoded = result.trim()
    } else if (isLinux()) {
      const result = execSync(`secret-tool lookup service "${SERVICE_NAME}" account "${ACCOUNT_NAME}"`, {
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf8',
      })
      encoded = result.trim()
    } else if (isWindows()) {
      const xmlPath = getConfigPath().replace('config.json', 'mepass-credential.xml')
      if (fs.existsSync(xmlPath)) {
        const ps = `Import-CliXml -Path "${xmlPath}" | Select-Object -ExpandProperty Password`
        const result = execSync(`powershell -Command "${ps}"`, {
          stdio: ['pipe', 'pipe', 'pipe'],
          encoding: 'utf8',
        })
        encoded = result.trim()
      }
    }
    if (encoded) {
      return Buffer.from(encoded, 'base64')
    }
    return null
  } catch {
    return null
  }
}

function saveToLocalFile(key: Buffer): void {
  const keyPath = getVaultKeyPath()
  fs.writeFileSync(keyPath, key.toString('base64'), { mode: 0o600 })
  if (!isWindows()) {
    try {
      fs.chmodSync(keyPath, 0o600)
    } catch {
      // best effort
    }
  }
}

function readFromLocalFile(): Buffer | null {
  const keyPath = getVaultKeyPath()
  if (!fs.existsSync(keyPath)) return null
  const content = fs.readFileSync(keyPath, 'utf8').trim()
  return Buffer.from(content, 'base64')
}

export async function getKey(): Promise<Buffer | null> {
  const fromKeychain = readFromSystemKeychain()
  if (fromKeychain) return fromKeychain
  return readFromLocalFile()
}

export async function saveKey(key: Buffer): Promise<KeyStoreSource> {
  ensureDataDir()
  if (saveToSystemKeychain(key)) {
    return 'system-keychain'
  }
  saveToLocalFile(key)
  return 'local-key-file'
}

export async function getSource(): Promise<KeyStoreSource> {
  const fromKeychain = readFromSystemKeychain()
  if (fromKeychain) return 'system-keychain'
  const fromFile = readFromLocalFile()
  if (fromFile) return 'local-key-file'
  return 'local-key-file'
}

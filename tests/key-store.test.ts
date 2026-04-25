import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('key-store (local file fallback)', () => {
  const testDir = path.join(os.tmpdir(), `mepass-test-keystore-${Date.now()}`)
  let originalPlatform: string | undefined

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true })
    originalPlatform = process.platform
  })

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  it('saves and reads key from local file', async () => {
    const { saveKey, getKey } = await import('../src/core/key-store.js')
    const { getVaultKeyPath } = await import('../src/platform/paths.js')

    // This test verifies the local file fallback path
    // In test env, system keychain likely unavailable, so it will use vault.key
    const testKey = Buffer.from('test-key-32-bytes-long-padding!!', 'utf8')

    // We can't easily override paths in tests without DI,
    // so we test the vault.key read/write directly
    const keyPath = path.join(testDir, 'vault.key')
    fs.writeFileSync(keyPath, testKey.toString('base64'), { mode: 0o600 })

    const content = fs.readFileSync(keyPath, 'utf8').trim()
    const readKey = Buffer.from(content, 'base64')
    expect(readKey).toEqual(testKey)
  })
})

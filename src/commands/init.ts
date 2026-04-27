import { input, password, confirm } from '@inquirer/prompts'
import { getDb } from '../db/connection.js'
import { ensureDataDir, getDataDir, getDbPath, getConfigPath } from '../platform/paths.js'
import { generateDataKey, generateSalt, deriveKeyEncryptionKey, encryptDataKey, encryptText } from '../core/crypto.js'
import { saveKey, getSource } from '../core/key-store.js'
import { setMeta, isInitialized } from '../db/entries-repository.js'
import { KDF_DEFAULTS } from '../types/entry.js'
import fs from 'node:fs'

export async function initCommand(): Promise<void> {
  ensureDataDir()
  const db = await getDb()

  if (isInitialized(db)) {
    console.log('数据库已初始化，跳过。如需重新初始化，请先删除数据库文件。')
    return
  }

  const masterPassword = await password({ message: '设置主密码（用于加密和迁移解锁）', mask: '*' })
  const confirmPassword = await password({ message: '确认主密码', mask: '*' })

  if (masterPassword !== confirmPassword) {
    console.log('两次输入的主密码不一致，请重试。')
    return
  }

  if (masterPassword.length < 6) {
    console.log('主密码长度不能少于 6 位。')
    return
  }

  const dataKey = generateDataKey()
  const salt = generateSalt()
  const kek = deriveKeyEncryptionKey(masterPassword, salt)
  const encryptedDataKey = encryptDataKey(dataKey, kek)

  const keySource = await saveKey(dataKey)

  const now = new Date().toISOString()
  setMeta(db, 'schema_version', '1')
  setMeta(db, 'created_at', now)
  setMeta(db, 'key_source', keySource)
  setMeta(db, 'kdf_algorithm', KDF_DEFAULTS.algorithm)
  setMeta(db, 'kdf_params', JSON.stringify(KDF_DEFAULTS))
  setMeta(db, 'kdf_salt', salt.toString('base64'))
  setMeta(db, 'encrypted_data_key_cipher', encryptedDataKey.cipher)
  setMeta(db, 'encrypted_data_key_iv', encryptedDataKey.iv)
  setMeta(db, 'encrypted_data_key_auth_tag', encryptedDataKey.authTag)

  // 写入 key_check：用 dataKey 加密已知明文，用于验证本地缓存的 key 是否有效
  const keyCheck = encryptText('mepass-key-check', dataKey)
  setMeta(db, 'key_check_cipher', keyCheck.cipher)
  setMeta(db, 'key_check_iv', keyCheck.iv)
  setMeta(db, 'key_check_auth_tag', keyCheck.authTag)

  console.log('')
  console.log('初始化完成！')
  console.log(`  数据目录：${getDataDir()}`)
  console.log(`  数据库路径：${getDbPath()}`)
  console.log(`  配置路径：${getConfigPath()}`)
  console.log(`  密钥来源：${keySource === 'system-keychain' ? '系统钥匙串' : '本地密钥文件'}`)
}

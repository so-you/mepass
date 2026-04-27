import { password } from '@inquirer/prompts'
import type { Database } from 'sql.js'
import { getKey, saveKey, deleteKey } from '../core/key-store.js'
import { getMeta, isInitialized, hasEncryptedDataKey } from '../db/entries-repository.js'
import { deriveKeyEncryptionKey, decryptDataKey, decryptText } from '../core/crypto.js'
import { MePassError } from '../types/entry.js'
import { setMeta } from '../db/entries-repository.js'
import { saveDb } from '../db/connection.js'

export type EnsureKeyResult = { dataKey: Buffer; rebinded?: boolean }

export async function requireMasterPassword(db: Database): Promise<Buffer> {
  console.log('请输入主密码以验证身份。')
  const masterPwd = await password({ message: '主密码', mask: '*' })

  const saltBase64 = getMeta(db, 'kdf_salt')
  const kdfParamsStr = getMeta(db, 'kdf_params')
  const encCipher = getMeta(db, 'encrypted_data_key_cipher')
  const encIv = getMeta(db, 'encrypted_data_key_iv')
  const encTag = getMeta(db, 'encrypted_data_key_auth_tag')

  if (!saltBase64 || !kdfParamsStr || !encCipher || !encIv || !encTag) {
    throw new MePassError('KEY_MISSING', '找不到可用解密材料，请检查数据库完整性')
  }

  const salt = Buffer.from(saltBase64, 'base64')
  const kdfParams = JSON.parse(kdfParamsStr)
  const kek = deriveKeyEncryptionKey(masterPwd, salt, kdfParams)

  try {
    return decryptDataKey(
      { cipher: encCipher, iv: encIv, authTag: encTag },
      kek
    )
  } catch {
    throw new MePassError('DECRYPT_FAILED', '主密码错误')
  }
}

export async function ensureDataKey(db: Database): Promise<EnsureKeyResult | null> {
  if (!isInitialized(db)) {
    return null
  }

  const localKey = await getKey()
  if (localKey) {
    if (verifyKeyCheck(db, localKey)) {
      return { dataKey: localKey }
    }
    // 本地密钥无效（可能是旧数据库迁移），清除并引导重新绑定
    await deleteKey()
    console.log('本机密钥与当前数据库不匹配，请输入主密码以重新绑定。')
  }

  if (!hasEncryptedDataKey(db)) {
    return null
  }

  console.log('本机密钥缺失，请输入主密码以解锁。')
  const masterPwd = await password({ message: '主密码', mask: '*' })

  const saltBase64 = getMeta(db, 'kdf_salt')
  const kdfParamsStr = getMeta(db, 'kdf_params')
  const encCipher = getMeta(db, 'encrypted_data_key_cipher')
  const encIv = getMeta(db, 'encrypted_data_key_iv')
  const encTag = getMeta(db, 'encrypted_data_key_auth_tag')

  if (!saltBase64 || !kdfParamsStr || !encCipher || !encIv || !encTag) {
    throw new MePassError('KEY_MISSING', '找不到可用解密材料，请检查数据库完整性')
  }

  const salt = Buffer.from(saltBase64, 'base64')
  const kdfParams = JSON.parse(kdfParamsStr)
  const kek = deriveKeyEncryptionKey(masterPwd, salt, kdfParams)

  let dataKey: Buffer
  try {
    dataKey = decryptDataKey(
      { cipher: encCipher, iv: encIv, authTag: encTag },
      kek
    )
  } catch {
    throw new MePassError('DECRYPT_FAILED', '主密码错误或数据已损坏')
  }

  const keySource = await saveKey(dataKey)
  setMeta(db, 'key_source', keySource)
  saveDb()

  console.log('解锁成功，已绑定当前设备。')
  return { dataKey, rebinded: true }
}

function verifyKeyCheck(db: Database, dataKey: Buffer): boolean {
  const cipher = getMeta(db, 'key_check_cipher')
  const iv = getMeta(db, 'key_check_iv')
  const authTag = getMeta(db, 'key_check_auth_tag')

  if (!cipher || !iv || !authTag) {
    // 没有 key_check（旧版数据库），跳过验证
    return true
  }

  try {
    const plain = decryptText({ cipher, iv, authTag }, dataKey)
    return plain === 'mepass-key-check'
  } catch {
    return false
  }
}

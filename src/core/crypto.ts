import crypto from 'node:crypto'
import { KDF_DEFAULTS, type KdfParams, type EncryptedField } from '../types/entry.js'

export function generateDataKey(): Buffer {
  return crypto.randomBytes(32)
}

export function generateSalt(): Buffer {
  return crypto.randomBytes(16)
}

export function deriveKeyEncryptionKey(masterPassword: string, salt: Buffer, params: KdfParams = KDF_DEFAULTS): Buffer {
  const maxmem = 128 * params.N * (params.r + params.p) + 1024 * 1024
  return crypto.scryptSync(masterPassword, salt, params.keyLength, {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem,
  })
}

export function encryptDataKey(dataKey: Buffer, kek: Buffer): EncryptedField {
  return encrypt(Buffer.from(dataKey).toString('base64'), kek)
}

export function decryptDataKey(encrypted: EncryptedField, kek: Buffer): Buffer {
  const base64 = decrypt(encrypted, kek)
  return Buffer.from(base64, 'base64')
}

export function encrypt(plainText: string, key: Buffer): EncryptedField {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return {
    cipher: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  }
}

export function decrypt(field: EncryptedField, key: Buffer): string {
  const iv = Buffer.from(field.iv, 'base64')
  const authTag = Buffer.from(field.authTag, 'base64')
  const cipherText = Buffer.from(field.cipher, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()])
  return decrypted.toString('utf8')
}

export function encryptText(plainText: string, key: Buffer): EncryptedField {
  return encrypt(plainText, key)
}

export function decryptText(field: EncryptedField, key: Buffer): string {
  return decrypt(field, key)
}

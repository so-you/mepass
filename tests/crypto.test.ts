import { describe, it, expect } from 'vitest'
import { encryptText, decryptText, generateDataKey, generateSalt, deriveKeyEncryptionKey, encryptDataKey, decryptDataKey } from '../src/core/crypto.js'

describe('crypto', () => {
  it('encrypts and decrypts text correctly', () => {
    const key = generateDataKey()
    const plain = 'my-secret-password'
    const encrypted = encryptText(plain, key)
    expect(encrypted.cipher).not.toBe(plain)
    expect(encrypted.iv).toBeTruthy()
    expect(encrypted.authTag).toBeTruthy()
    const decrypted = decryptText(encrypted, key)
    expect(decrypted).toBe(plain)
  })

  it('fails to decrypt tampered ciphertext', () => {
    const key = generateDataKey()
    const encrypted = encryptText('test', key)
    const tampered = { ...encrypted, cipher: Buffer.from('tampered').toString('base64') }
    expect(() => decryptText(tampered, key)).toThrow()
  })

  it('generates unique IVs for each encryption', () => {
    const key = generateDataKey()
    const enc1 = encryptText('same-text', key)
    const enc2 = encryptText('same-text', key)
    expect(enc1.iv).not.toBe(enc2.iv)
    expect(enc1.cipher).not.toBe(enc2.cipher)
  })

  it('encrypts and decrypts data key with KEK', () => {
    const dataKey = generateDataKey()
    const salt = generateSalt()
    const kek = deriveKeyEncryptionKey('master-password', salt)
    const encrypted = encryptDataKey(dataKey, kek)
    const decrypted = decryptDataKey(encrypted, kek)
    expect(decrypted).toEqual(dataKey)
  })

  it('fails to decrypt data key with wrong password', () => {
    const dataKey = generateDataKey()
    const salt = generateSalt()
    const kek = deriveKeyEncryptionKey('correct-password', salt)
    const encrypted = encryptDataKey(dataKey, kek)
    const wrongKek = deriveKeyEncryptionKey('wrong-password', salt)
    expect(() => decryptDataKey(encrypted, wrongKek)).toThrow()
  })
})

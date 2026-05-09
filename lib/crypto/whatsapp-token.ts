/**
 * AES-256-GCM encryption for WhatsApp access tokens stored in branch_whatsapp_config.
 *
 * Usage: Server Actions only, via service role client. Never called from client components.
 *
 * Env var required:
 *   WHATSAPP_TOKEN_ENC_KEY — 32 random bytes as 64 hex characters.
 *   Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Stored format: <iv_hex>:<authTag_hex>:<ciphertext_hex>
 *   iv       — 12 bytes (96-bit), unique per encryption
 *   authTag  — 16 bytes, GCM authentication tag (detects tampering)
 *   ciphertext — variable length
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGO = 'aes-256-gcm'

function getKey(): Buffer {
  const hex = process.env.WHATSAPP_TOKEN_ENC_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      'WHATSAPP_TOKEN_ENC_KEY must be a 64-character hex string. ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  return Buffer.from(hex, 'hex')
}

export function encryptToken(plaintext: string): string {
  const key = getKey()
  const iv  = randomBytes(12)

  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':')
}

export function decryptToken(stored: string): string {
  const key    = getKey()
  const parts  = stored.split(':')

  if (parts.length !== 3) {
    throw new Error('invalid_token_format: expected iv:authTag:ciphertext')
  }

  const [ivHex, authTagHex, encHex] = parts
  const iv         = Buffer.from(ivHex,      'hex')
  const authTag    = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(encHex,     'hex')

  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}

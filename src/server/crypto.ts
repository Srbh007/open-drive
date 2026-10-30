import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { env } from '@/env'

let cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (cachedKey) return cachedKey
  const key = Buffer.from(env.ENCRYPTION_KEY, 'base64')
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY must decode to 32 bytes')
  cachedKey = key
  return key
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, ciphertext].map((b) => b.toString('base64url')).join('.')
}

export function decrypt(token: string): string {
  const [ivPart, tagPart, ctPart] = token.split('.')
  if (!ivPart || !tagPart || !ctPart) throw new Error('Invalid encrypted value')
  const iv = Buffer.from(ivPart, 'base64url')
  if (iv.length !== 12) throw new Error('Invalid IV length')
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv)
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(ctPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

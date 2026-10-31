import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './links'

describe('Links Password Utilities', () => {
  it('should hash and verify a password correctly', async () => {
    const password = 'my-super-secret-password'
    
    const hash = await hashPassword(password)
    expect(hash).toContain(':')
    
    const isValid = await verifyPassword(password, hash)
    expect(isValid).toBe(true)
    
    const isInvalid = await verifyPassword('wrong-password', hash)
    expect(isInvalid).toBe(false)
  })
})

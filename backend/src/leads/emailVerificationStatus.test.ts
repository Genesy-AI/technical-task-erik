import { describe, expect, it } from 'vitest'
import {
  canTransitionEmailVerification,
  EmailVerificationState,
  EmailVerificationStatus,
  emailVerificationSourceStates,
} from './emailVerificationStatus'

describe('canTransitionEmailVerification', () => {
  const allowed: Array<[EmailVerificationState, EmailVerificationStatus]> = [
    [null, 'PENDING'],
    ['PENDING', 'VERIFIED'],
    ['PENDING', 'INVALID'],
    ['PENDING', 'FAILED'],
    ['FAILED', 'PENDING'],
    ['VERIFIED', 'PENDING'],
    ['INVALID', 'PENDING'],
  ]

  const forbidden: Array<[EmailVerificationState, EmailVerificationStatus]> = [
    [null, 'VERIFIED'],
    [null, 'INVALID'],
    [null, 'FAILED'],
    ['PENDING', 'PENDING'],
    ['VERIFIED', 'INVALID'],
    ['VERIFIED', 'FAILED'],
    ['INVALID', 'VERIFIED'],
    ['FAILED', 'VERIFIED'],
    ['FAILED', 'FAILED'],
  ]

  it.each(allowed)('allows %s -> %s', (from, to) => {
    expect(canTransitionEmailVerification(from, to)).toBe(true)
  })

  it.each(forbidden)('rejects %s -> %s', (from, to) => {
    expect(canTransitionEmailVerification(from, to)).toBe(false)
  })
})

describe('emailVerificationSourceStates', () => {
  it('lets every non-pending state (including never verified) start a verification', () => {
    expect(emailVerificationSourceStates('PENDING')).toEqual([null, 'VERIFIED', 'INVALID', 'FAILED'])
  })

  it('only lets a pending verification resolve to an outcome', () => {
    expect(emailVerificationSourceStates('VERIFIED')).toEqual(['PENDING'])
    expect(emailVerificationSourceStates('INVALID')).toEqual(['PENDING'])
    expect(emailVerificationSourceStates('FAILED')).toEqual(['PENDING'])
  })
})

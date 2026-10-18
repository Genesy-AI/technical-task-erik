import { describe, it, expect } from 'vitest'
import { resolveCompanyWebsite, toBareDomain } from './companyWebsite'

describe('toBareDomain', () => {
  it.each([
    ['acme.com', 'acme.com'],
    ['https://www.Acme.com/about?x=1', 'acme.com'],
    ['http://sub.acme.co.uk', 'sub.acme.co.uk'],
    ['  acme.io  ', 'acme.io'],
  ])('%s → %s', (value, expected) => {
    expect(toBareDomain(value)).toBe(expected)
  })

  it.each(['', 'not a domain', 'localhost', 'http://'])('rejects %j', (value) => {
    expect(toBareDomain(value)).toBeNull()
  })
})

describe('resolveCompanyWebsite', () => {
  it('prefers the stored company website', () => {
    expect(resolveCompanyWebsite({ companyWebsite: 'https://acme.com', email: 'ada@other.com' })).toBe(
      'acme.com'
    )
  })

  it('falls back to a business email domain', () => {
    expect(resolveCompanyWebsite({ companyWebsite: null, email: 'ada@ibarra-bowman.com' })).toBe(
      'ibarra-bowman.com'
    )
  })

  it('falls back when the stored website is garbage', () => {
    expect(resolveCompanyWebsite({ companyWebsite: '???', email: 'ada@acme.com' })).toBe('acme.com')
  })

  it.each(['ada@gmail.com', 'ada@yahoo.co.uk', 'ada@hotmail.com', 'ada@outlook.es', 'not-an-email'])(
    'returns null for %s',
    (email) => {
      expect(resolveCompanyWebsite({ email })).toBeNull()
    }
  )
})

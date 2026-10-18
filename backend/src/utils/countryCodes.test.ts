import { describe, it, expect } from 'vitest'
import { COUNTRY_CODES, normalizeCountryCode } from './countryCodes'

describe('COUNTRY_CODES', () => {
  it('contains all 249 officially assigned ISO 3166-1 alpha-2 codes', () => {
    expect(COUNTRY_CODES.size).toBe(249)
    for (const code of COUNTRY_CODES) {
      expect(code).toMatch(/^[A-Z]{2}$/)
    }
  })
})

describe('normalizeCountryCode', () => {
  it('accepts valid codes', () => {
    expect(normalizeCountryCode('ES')).toBe('ES')
    expect(normalizeCountryCode('US')).toBe('US')
    expect(normalizeCountryCode('TV')).toBe('TV')
  })

  it('trims and uppercases', () => {
    expect(normalizeCountryCode(' es ')).toBe('ES')
    expect(normalizeCountryCode('Fr')).toBe('FR')
  })

  it('maps the UK alias to GB', () => {
    expect(normalizeCountryCode('UK')).toBe('GB')
    expect(normalizeCountryCode('uk')).toBe('GB')
  })

  it('rejects invalid codes', () => {
    expect(normalizeCountryCode('XXX')).toBeNull()
    expect(normalizeCountryCode('12')).toBeNull()
    expect(normalizeCountryCode('XX')).toBeNull()
    expect(normalizeCountryCode('E')).toBeNull()
    expect(normalizeCountryCode('Spain')).toBeNull()
  })

  it('returns null for empty and non-string values', () => {
    expect(normalizeCountryCode('')).toBeNull()
    expect(normalizeCountryCode('   ')).toBeNull()
    expect(normalizeCountryCode(null)).toBeNull()
    expect(normalizeCountryCode(undefined)).toBeNull()
    expect(normalizeCountryCode(12)).toBeNull()
  })
})

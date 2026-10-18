import { describe, it, expect } from 'vitest'
import { COUNTRY_CODES, normalizeCountryCode } from './countryCodes'

describe('normalizeCountryCode', () => {
  it('knows all 249 officially assigned ISO 3166-1 alpha-2 codes', () => {
    expect(COUNTRY_CODES.size).toBe(249)
  })

  it('trims, uppercases and validates', () => {
    expect(normalizeCountryCode(' es ')).toBe('ES')
    expect(normalizeCountryCode('US')).toBe('US')
    expect(normalizeCountryCode('XXX')).toBeNull()
    expect(normalizeCountryCode('12')).toBeNull()
    expect(normalizeCountryCode('')).toBeNull()
    expect(normalizeCountryCode(undefined)).toBeNull()
  })

  it('maps the UK alias to GB', () => {
    expect(normalizeCountryCode('uk')).toBe('GB')
  })
})

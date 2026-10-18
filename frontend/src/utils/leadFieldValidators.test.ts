import { describe, it, expect } from 'vitest'
import {
  normalizeCompanyWebsite,
  normalizeLinkedinUrl,
  normalizePhoneNumber,
  normalizeYearsAtCompany,
} from './leadFieldValidators'

describe('normalizeYearsAtCompany', () => {
  it('accepts non-negative integers as numbers or strings', () => {
    expect(normalizeYearsAtCompany(0)).toBe(0)
    expect(normalizeYearsAtCompany(15)).toBe(15)
    expect(normalizeYearsAtCompany('10')).toBe(10)
    expect(normalizeYearsAtCompany(' 2 ')).toBe(2)
    expect(normalizeYearsAtCompany('0')).toBe(0)
    expect(normalizeYearsAtCompany(80)).toBe(80)
  })

  it('rounds decimals down to whole years', () => {
    expect(normalizeYearsAtCompany(2.5)).toBe(2)
    expect(normalizeYearsAtCompany('2.5')).toBe(2)
    expect(normalizeYearsAtCompany('2.99')).toBe(2)
    expect(normalizeYearsAtCompany(0.5)).toBe(0)
    expect(normalizeYearsAtCompany('80.9')).toBe(80)
  })

  it('rejects negative, out of range and non-numeric values', () => {
    expect(normalizeYearsAtCompany(-1)).toBeNull()
    expect(normalizeYearsAtCompany('-1')).toBeNull()
    expect(normalizeYearsAtCompany(-0.5)).toBeNull()
    expect(normalizeYearsAtCompany(81)).toBeNull()
    expect(normalizeYearsAtCompany('81.5')).toBeNull()
    expect(normalizeYearsAtCompany('2,5')).toBeNull()
    expect(normalizeYearsAtCompany('2.')).toBeNull()
    expect(normalizeYearsAtCompany(Infinity)).toBeNull()
    expect(normalizeYearsAtCompany('ten')).toBeNull()
    expect(normalizeYearsAtCompany('5 years')).toBeNull()
    expect(normalizeYearsAtCompany(NaN)).toBeNull()
    expect(normalizeYearsAtCompany('')).toBeNull()
    expect(normalizeYearsAtCompany(null)).toBeNull()
  })
})

describe('normalizePhoneNumber', () => {
  it('accepts the formats found in the sample CSVs', () => {
    const phones = [
      '+1-280-754-0462x2154',
      '001-464-312-8555',
      '(731)123-9702',
      '063.430.8860x4762',
      '7549075690',
      '+1-627-991-1712x7922',
    ]
    for (const phone of phones) {
      expect(normalizePhoneNumber(phone)).toBe(phone)
    }
  })

  it('accepts spaces and "ext" extensions, collapsing whitespace', () => {
    expect(normalizePhoneNumber(' +34  600 123 456 ')).toBe('+34 600 123 456')
    expect(normalizePhoneNumber('555-123-4567 ext. 89')).toBe('555-123-4567 ext. 89')
  })

  it('rejects values with too few digits or invalid characters', () => {
    expect(normalizePhoneNumber('12345')).toBeNull()
    expect(normalizePhoneNumber('call me')).toBeNull()
    expect(normalizePhoneNumber('555-CALL-NOW')).toBeNull()
    expect(normalizePhoneNumber('123x4567')).toBeNull()
    expect(normalizePhoneNumber('')).toBeNull()
    expect(normalizePhoneNumber(5551234567)).toBeNull()
  })
})

describe('normalizeLinkedinUrl', () => {
  it('accepts linkedin.com URLs', () => {
    expect(normalizeLinkedinUrl('https://www.linkedin.com/in/ada')).toBe('https://www.linkedin.com/in/ada')
    expect(normalizeLinkedinUrl('http://es.linkedin.com/in/ada')).toBe('http://es.linkedin.com/in/ada')
  })

  it('adds a missing scheme', () => {
    expect(normalizeLinkedinUrl('linkedin.com/in/ada')).toBe('https://linkedin.com/in/ada')
    expect(normalizeLinkedinUrl(' www.linkedin.com/in/ada ')).toBe('https://www.linkedin.com/in/ada')
  })

  it('rejects other domains, schemes and URLs without a path', () => {
    expect(normalizeLinkedinUrl('https://example.com/in/ada')).toBeNull()
    expect(normalizeLinkedinUrl('https://linkedin.com.evil.com/in/ada')).toBeNull()
    expect(normalizeLinkedinUrl('https://notlinkedin.com/in/ada')).toBeNull()
    expect(normalizeLinkedinUrl('ftp://linkedin.com/in/ada')).toBeNull()
    expect(normalizeLinkedinUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeLinkedinUrl('https://linkedin.com')).toBeNull()
    expect(normalizeLinkedinUrl('ada lovelace')).toBeNull()
    expect(normalizeLinkedinUrl('')).toBeNull()
  })
})

describe('normalizeCompanyWebsite', () => {
  it('normalizes to a bare lowercase domain', () => {
    expect(normalizeCompanyWebsite('example.com')).toBe('example.com')
    expect(normalizeCompanyWebsite('https://www.Example.com/about?x=1')).toBe('example.com')
    expect(normalizeCompanyWebsite('http://shop.example.co.uk')).toBe('shop.example.co.uk')
  })

  it('rejects values that are not domains', () => {
    expect(normalizeCompanyWebsite('Acme Inc')).toBeNull()
    expect(normalizeCompanyWebsite('localhost')).toBeNull()
    expect(normalizeCompanyWebsite('192.168.0.1')).toBeNull()
    expect(normalizeCompanyWebsite('ftp://example.com')).toBeNull()
    expect(normalizeCompanyWebsite('-bad-.com')).toBeNull()
    expect(normalizeCompanyWebsite('')).toBeNull()
    expect(normalizeCompanyWebsite(null)).toBeNull()
  })
})

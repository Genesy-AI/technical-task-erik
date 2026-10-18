import { describe, it, expect } from 'vitest'
import { hasRequiredLeadFields, sanitizeImportedLead } from './leadImport'

const baseLead = { firstName: ' Ada ', lastName: ' Lovelace ', email: ' ada@example.com ' }

describe('hasRequiredLeadFields', () => {
  it('accepts leads with firstName, lastName and email', () => {
    expect(hasRequiredLeadFields(baseLead)).toBe(true)
  })

  it('rejects leads missing or with blank required fields', () => {
    expect(hasRequiredLeadFields({ ...baseLead, firstName: '' })).toBe(false)
    expect(hasRequiredLeadFields({ ...baseLead, lastName: '   ' })).toBe(false)
    expect(hasRequiredLeadFields({ firstName: 'Ada', lastName: 'Lovelace' })).toBe(false)
    expect(hasRequiredLeadFields({ ...baseLead, email: 42 })).toBe(false)
    expect(hasRequiredLeadFields(null)).toBe(false)
    expect(hasRequiredLeadFields('lead')).toBe(false)
  })
})

describe('sanitizeImportedLead', () => {
  it('trims required and optional fields', () => {
    expect(
      sanitizeImportedLead({
        ...baseLead,
        jobTitle: ' Engineer ',
        companyName: ' Acme ',
        countryCode: ' gb ',
      })
    ).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      jobTitle: 'Engineer',
      companyName: 'Acme',
      countryCode: 'GB',
    })
  })

  it('stores invalid country codes as null instead of rejecting the lead', () => {
    expect(sanitizeImportedLead({ ...baseLead, countryCode: 'XXX' }).countryCode).toBeNull()
    expect(sanitizeImportedLead({ ...baseLead, countryCode: '12' }).countryCode).toBeNull()
  })

  it('stores missing, blank or non-string optional fields as null', () => {
    const result = sanitizeImportedLead({ ...baseLead, jobTitle: '', companyName: 123 })
    expect(result.jobTitle).toBeNull()
    expect(result.companyName).toBeNull()
    expect(result.countryCode).toBeNull()
  })
})

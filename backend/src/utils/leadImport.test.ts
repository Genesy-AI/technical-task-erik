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
      phoneNumber: null,
      yearsAtCompany: null,
      linkedinUrl: null,
      companyWebsite: null,
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

  it('normalizes the new lead fields', () => {
    const result = sanitizeImportedLead({
      ...baseLead,
      phoneNumber: ' +1-280-754-0462x2154 ',
      yearsAtCompany: 0,
      linkedinUrl: 'linkedin.com/in/ada',
      companyWebsite: 'https://www.acme.com/',
    })
    expect(result).toMatchObject({
      phoneNumber: '+1-280-754-0462x2154',
      yearsAtCompany: 0,
      linkedinUrl: 'https://linkedin.com/in/ada',
      companyWebsite: 'acme.com',
    })
  })

  it('rounds fractional years at company down', () => {
    expect(sanitizeImportedLead({ ...baseLead, yearsAtCompany: 2.5 }).yearsAtCompany).toBe(2)
  })

  it('stores invalid new lead fields as null instead of rejecting the lead', () => {
    const result = sanitizeImportedLead({
      ...baseLead,
      phoneNumber: 'call me',
      yearsAtCompany: -3,
      linkedinUrl: 'https://example.com/in/ada',
      companyWebsite: 'not a website',
    })
    expect(result).toMatchObject({
      firstName: 'Ada',
      phoneNumber: null,
      yearsAtCompany: null,
      linkedinUrl: null,
      companyWebsite: null,
    })
  })
})

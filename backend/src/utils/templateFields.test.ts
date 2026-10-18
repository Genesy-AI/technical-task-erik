import { describe, it, expect } from 'vitest'
import { isTemplateFieldKey, TEMPLATE_FIELDS } from './templateFields'

describe('TEMPLATE_FIELDS', () => {
  it('has unique keys that are valid placeholder names', () => {
    const keys = TEMPLATE_FIELDS.map((field) => field.key)
    expect(new Set(keys).size).toBe(keys.length)
    keys.forEach((key) => expect(key).toMatch(/^\w+$/))
  })

  it('includes the new lead fields', () => {
    const keys = TEMPLATE_FIELDS.map((field) => field.key)
    expect(keys).toEqual(
      expect.arrayContaining(['phoneNumber', 'yearsAtCompany', 'linkedinUrl', 'companyWebsite'])
    )
  })
})

describe('isTemplateFieldKey', () => {
  it('recognizes registered fields only', () => {
    expect(isTemplateFieldKey('firstName')).toBe(true)
    expect(isTemplateFieldKey('yearsAtCompany')).toBe(true)
    expect(isTemplateFieldKey('id')).toBe(false)
    expect(isTemplateFieldKey('FirstName')).toBe(false)
  })
})

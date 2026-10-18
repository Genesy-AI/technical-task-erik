import { describe, it, expect } from 'vitest'
import type { TemplateField } from '../api/types/leads/templateFields'
import {
  completePartialToken,
  filterTemplateFields,
  findPartialToken,
  groupTemplateFields,
  insertPlaceholder,
  renderTemplatePreview,
} from './messageTemplate'

const fields: TemplateField[] = [
  { key: 'firstName', label: 'First name', group: 'Contact' },
  { key: 'lastName', label: 'Last name', group: 'Contact' },
  { key: 'phoneNumber', label: 'Phone number', group: 'Contact' },
  { key: 'companyName', label: 'Company name', group: 'Company' },
  { key: 'yearsAtCompany', label: 'Years at company', group: 'Company' },
  { key: 'linkedinUrl', label: 'LinkedIn profile', group: 'Social' },
]

describe('groupTemplateFields', () => {
  it('groups fields keeping registry order', () => {
    const groups = groupTemplateFields(fields)
    expect(groups.map((group) => group.group)).toEqual(['Contact', 'Company', 'Social'])
    expect(groups[0].fields.map((field) => field.key)).toEqual(['firstName', 'lastName', 'phoneNumber'])
  })

  it('returns no groups for no fields', () => {
    expect(groupTemplateFields([])).toEqual([])
  })
})

describe('filterTemplateFields', () => {
  const keys = (result: TemplateField[]) => result.map((field) => field.key)

  it('returns all fields for an empty query', () => {
    expect(filterTemplateFields(fields, '  ')).toEqual(fields)
  })

  it('matches keys and labels case-insensitively', () => {
    expect(keys(filterTemplateFields(fields, 'FIRST'))).toEqual(['firstName'])
    expect(keys(filterTemplateFields(fields, 'profile'))).toEqual(['linkedinUrl'])
  })

  it('ranks prefix matches before substring matches', () => {
    // "company" prefixes companyName and the "company" word in "Years at company"; nothing else contains it
    expect(keys(filterTemplateFields(fields, 'company'))).toEqual(['companyName', 'yearsAtCompany'])
    // "name" is a label word prefix for all *name fields, and a key substring only for them too
    expect(keys(filterTemplateFields(fields, 'name'))).toEqual(['firstName', 'lastName', 'companyName'])
    // "num" is a word prefix in "Phone number"
    expect(keys(filterTemplateFields(fields, 'num'))).toEqual(['phoneNumber'])
    // "inkedin" only matches as a substring
    expect(keys(filterTemplateFields(fields, 'inkedin'))).toEqual(['linkedinUrl'])
  })

  it('returns nothing when no field matches', () => {
    expect(filterTemplateFields(fields, 'zzz')).toEqual([])
  })
})

describe('findPartialToken', () => {
  it('detects a placeholder being typed', () => {
    expect(findPartialToken('Hi {fir', 7)).toEqual({ start: 3, query: 'fir' })
  })

  it('detects an empty query right after the opening brace', () => {
    expect(findPartialToken('Hi {', 4)).toEqual({ start: 3, query: '' })
  })

  it('uses the text up to the caret only', () => {
    expect(findPartialToken('Hi {firstName}', 6)).toEqual({ start: 3, query: 'fi' })
  })

  it('returns null outside of a placeholder', () => {
    expect(findPartialToken('Hi there', 8)).toBeNull()
    expect(findPartialToken('Hi {first name', 14)).toBeNull()
    expect(findPartialToken('Hi {firstName}', 14)).toBeNull()
    expect(findPartialToken('', 0)).toBeNull()
  })
})

describe('completePartialToken', () => {
  it('replaces the partial token with the full placeholder', () => {
    expect(completePartialToken('Hi {fir', 3, 7, 'firstName')).toEqual({
      text: 'Hi {firstName}',
      caret: 14,
    })
  })

  it('keeps the text after the caret', () => {
    expect(completePartialToken('Hi {fir, welcome', 3, 7, 'firstName')).toEqual({
      text: 'Hi {firstName}, welcome',
      caret: 14,
    })
  })

  it('consumes the rest of the word and a closing brace after the caret', () => {
    expect(completePartialToken('Hi {fiXX} there', 3, 6, 'firstName')).toEqual({
      text: 'Hi {firstName} there',
      caret: 14,
    })
  })
})

describe('insertPlaceholder', () => {
  it('inserts at the caret', () => {
    expect(insertPlaceholder('Hi !', 3, 3, 'firstName')).toEqual({ text: 'Hi {firstName}!', caret: 14 })
  })

  it('replaces the selection', () => {
    expect(insertPlaceholder('Hi NAME!', 3, 7, 'firstName')).toEqual({ text: 'Hi {firstName}!', caret: 14 })
  })
})

describe('renderTemplatePreview', () => {
  const knownKeys = new Set(fields.map((field) => field.key))
  const lead = { firstName: 'Ada', lastName: null, companyName: '', yearsAtCompany: 0 }

  it('resolves values and keeps surrounding text', () => {
    expect(renderTemplatePreview('Hi {firstName}!', lead, knownKeys)).toEqual([
      { type: 'text', text: 'Hi ' },
      { type: 'value', key: 'firstName', text: 'Ada' },
      { type: 'text', text: '!' },
    ])
  })

  it('converts numbers to text and treats 0 as a value', () => {
    expect(renderTemplatePreview('{yearsAtCompany}', lead, knownKeys)).toEqual([
      { type: 'value', key: 'yearsAtCompany', text: '0' },
    ])
  })

  it('flags fields missing on the lead (null, undefined or empty)', () => {
    const segments = renderTemplatePreview('{lastName}{companyName}{phoneNumber}', lead, knownKeys)
    expect(segments.map((segment) => segment.type)).toEqual(['missing', 'missing', 'missing'])
    expect(segments[0].text).toBe('{lastName}')
  })

  it('flags unknown fields', () => {
    expect(renderTemplatePreview('Hi {nickname}', lead, knownKeys)).toEqual([
      { type: 'text', text: 'Hi ' },
      { type: 'unknown', key: 'nickname', text: '{nickname}' },
    ])
  })

  it('does not flag unknown fields while the field list is unavailable', () => {
    expect(renderTemplatePreview('{nickname}', lead)[0].type).toBe('missing')
  })

  it('leaves invalid placeholder syntax as text', () => {
    expect(renderTemplatePreview('Hi {first name} {}', lead, knownKeys)).toEqual([
      { type: 'text', text: 'Hi {first name} {}' },
    ])
  })

  it('inserts values containing replacement patterns literally', () => {
    const segments = renderTemplatePreview('{firstName}', { firstName: '$&' }, knownKeys)
    expect(segments).toEqual([{ type: 'value', key: 'firstName', text: '$&' }])
  })

  it('marks every field as missing when there is no lead', () => {
    expect(renderTemplatePreview('{firstName}', undefined, knownKeys)[0].type).toBe('missing')
  })
})

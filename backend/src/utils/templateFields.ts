import type { Lead } from './messageGenerator'

export type TemplateFieldGroup = 'Contact' | 'Company' | 'Social'

export interface TemplateField {
  /** Placeholder name used in templates as `{key}`; must be a lead property. */
  key: keyof Lead
  label: string
  group: TemplateFieldGroup
  example?: string
}

/**
 * Single source of truth for the lead fields that can be used in message templates. It drives both message
 * generation and the composer UI (served by GET /leads/template-fields): adding a field here is enough to
 * make it available everywhere.
 */
export const TEMPLATE_FIELDS: readonly TemplateField[] = [
  { key: 'firstName', label: 'First name', group: 'Contact', example: 'Ada' },
  { key: 'lastName', label: 'Last name', group: 'Contact', example: 'Lovelace' },
  { key: 'email', label: 'Email', group: 'Contact', example: 'ada@example.com' },
  { key: 'phoneNumber', label: 'Phone number', group: 'Contact', example: '+44 20 7946 0958' },
  { key: 'countryCode', label: 'Country code', group: 'Contact', example: 'GB' },
  { key: 'jobTitle', label: 'Job title', group: 'Company', example: 'Analyst' },
  { key: 'companyName', label: 'Company name', group: 'Company', example: 'Analytical Engines Ltd' },
  { key: 'companyWebsite', label: 'Company website', group: 'Company', example: 'example.com' },
  { key: 'yearsAtCompany', label: 'Years at company', group: 'Company', example: '5' },
  { key: 'linkedinUrl', label: 'LinkedIn profile', group: 'Social', example: 'https://linkedin.com/in/ada' },
]

const TEMPLATE_FIELD_KEYS: ReadonlySet<string> = new Set(TEMPLATE_FIELDS.map((field) => field.key))

export const isTemplateFieldKey = (key: string): key is TemplateField['key'] => TEMPLATE_FIELD_KEYS.has(key)

import { isTemplateFieldKey } from './templateFields'

export interface Lead {
  firstName: string
  lastName?: string | null
  email?: string | null
  jobTitle?: string | null
  companyName?: string | null
  countryCode?: string | null
  phoneNumber?: string | null
  yearsAtCompany?: number | null
  linkedinUrl?: string | null
  companyWebsite?: string | null
}

const TEMPLATE_VARIABLE_REGEX = /\{(\w+)\}/g

export function generateMessageFromTemplate(template: string, lead: Lead): string {
  // A single pass with a replacer function: lead values are inserted literally (no `$&`/`$1` expansion) and
  // are never re-scanned for placeholders.
  return template.replace(TEMPLATE_VARIABLE_REGEX, (_match, fieldName: string) => {
    if (!isTemplateFieldKey(fieldName)) {
      throw new Error(`Unknown field in template: ${fieldName}`)
    }

    const fieldValue = lead[fieldName]

    if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
      throw new Error(`Missing required field: ${fieldName}`)
    }

    return String(fieldValue)
  })
}

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

/** Placeholders in the template that aren't template fields, deduplicated in order of first appearance. */
export function findUnknownTemplateFields(template: string): string[] {
  const unknown = new Set<string>()
  for (const [, fieldName] of template.matchAll(TEMPLATE_VARIABLE_REGEX)) {
    if (!isTemplateFieldKey(fieldName)) unknown.add(fieldName)
  }
  return [...unknown]
}

export function generateMessageFromTemplate(template: string, lead: Lead): string {
  // Unknown fields are a template problem, not a lead problem: report them before checking any lead value so
  // every lead fails with the same error.
  const [unknownField] = findUnknownTemplateFields(template)
  if (unknownField) {
    throw new Error(`Unknown field in template: ${unknownField}`)
  }

  // A single pass with a replacer function: lead values are inserted literally (no `$&`/`$1` expansion) and
  // are never re-scanned for placeholders.
  return template.replace(TEMPLATE_VARIABLE_REGEX, (_match, fieldName: string) => {
    // Unreachable after the check above; kept so `fieldName` is narrowed to a lead key
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

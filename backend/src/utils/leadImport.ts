import { normalizeCountryCode } from './countryCodes'
import {
  normalizeCompanyWebsite,
  normalizeLinkedinUrl,
  normalizePhoneNumber,
  normalizeYearsAtCompany,
} from './leadFieldValidators'

export interface ImportedLeadData {
  firstName: string
  lastName: string
  email: string
  jobTitle: string | null
  countryCode: string | null
  companyName: string | null
  phoneNumber: string | null
  yearsAtCompany: number | null
  linkedinUrl: string | null
  companyWebsite: string | null
}

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && !!value.trim()

const optionalString = (value: unknown): string | null => (isNonEmptyString(value) ? value.trim() : null)

/**
 * A lead from a bulk import is importable when its required fields (firstName, lastName, email) are present.
 */
export const hasRequiredLeadFields = (
  lead: unknown
): lead is { firstName: string; lastName: string; email: string } & Record<string, unknown> => {
  if (!lead || typeof lead !== 'object') return false
  const { firstName, lastName, email } = lead as Record<string, unknown>
  return isNonEmptyString(firstName) && isNonEmptyString(lastName) && isNonEmptyString(email)
}

/**
 * Builds the data to persist for an imported lead. Optional fields are re-validated here because client-side
 * validation can't be trusted: an invalid optional value doesn't reject the lead, it's stored as null.
 */
export const sanitizeImportedLead = (
  lead: { firstName: string; lastName: string; email: string } & Record<string, unknown>
): ImportedLeadData => ({
  firstName: lead.firstName.trim(),
  lastName: lead.lastName.trim(),
  email: lead.email.trim(),
  jobTitle: optionalString(lead.jobTitle),
  countryCode: normalizeCountryCode(lead.countryCode),
  companyName: optionalString(lead.companyName),
  phoneNumber: normalizePhoneNumber(lead.phoneNumber),
  yearsAtCompany: normalizeYearsAtCompany(lead.yearsAtCompany),
  linkedinUrl: normalizeLinkedinUrl(lead.linkedinUrl),
  companyWebsite: normalizeCompanyWebsite(lead.companyWebsite),
})

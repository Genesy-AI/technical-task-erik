import Papa from 'papaparse'
import { normalizeCountryCode } from './countryCodes'
import {
  MAX_YEARS_AT_COMPANY,
  normalizeCompanyWebsite,
  normalizeLinkedinUrl,
  normalizePhoneNumber,
  normalizeYearsAtCompany,
} from './leadFieldValidators'

export interface CsvLead {
  firstName: string
  lastName: string
  email: string
  jobTitle?: string
  countryCode?: string
  companyName?: string
  phoneNumber?: string
  yearsAtCompany?: number
  linkedinUrl?: string
  companyWebsite?: string
  isValid: boolean
  /** Problems that prevent the row from being imported. */
  errors: string[]
  /** Problems with optional fields: the row is still imported, with the offending field left empty. */
  warnings: string[]
  rowIndex: number
}

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const parseCsv = (content: string): CsvLead[] => {
  if (!content?.trim()) {
    throw new Error('CSV content cannot be empty')
  }

  const parseResult = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transform: (value) => value.trim(),
    transformHeader: (header) => header.trim().toLowerCase(),
    quoteChar: '"',
  })

  if (parseResult.errors.length > 0) {
    const criticalErrors = parseResult.errors.filter(
      (error) => error.type === 'Delimiter' || error.type === 'Quotes' || error.type === 'FieldMismatch'
    )
    if (criticalErrors.length > 0) {
      throw new Error(`CSV parsing failed: ${criticalErrors[0].message}`)
    }
  }

  if (!parseResult.data || parseResult.data.length === 0) {
    throw new Error('CSV file appears to be empty or contains no valid data')
  }

  const data: CsvLead[] = []

  parseResult.data.forEach((row, index) => {
    if (Object.values(row).every((value) => !value)) return

    const lead: Partial<CsvLead> = { rowIndex: index + 2 }
    const warnings: string[] = []

    /** Optional fields never invalidate a row: an invalid value is dropped with a warning. */
    const validateOptional = <T>(
      rawValue: string,
      normalize: (value: string) => T | null,
      warning: string
    ): T | undefined => {
      if (!rawValue) return undefined
      const normalized = normalize(rawValue)
      if (normalized === null) {
        warnings.push(warning)
        return undefined
      }
      return normalized
    }

    Object.entries(row).forEach(([header, value]) => {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z]/g, '')
      const trimmedValue = value?.trim() || ''

      switch (normalizedHeader) {
        case 'firstname':
          lead.firstName = trimmedValue
          break
        case 'lastname':
          lead.lastName = trimmedValue
          break
        case 'email':
          lead.email = trimmedValue
          break
        case 'jobtitle':
          lead.jobTitle = trimmedValue || undefined
          break
        case 'countrycode':
          lead.countryCode = validateOptional(
            trimmedValue,
            normalizeCountryCode,
            `Invalid country code "${trimmedValue}" (expected ISO 3166-1 alpha-2, e.g. ES)`
          )
          break
        case 'companyname':
          lead.companyName = trimmedValue || undefined
          break
        case 'phonenumber':
        case 'phone':
          lead.phoneNumber = validateOptional(
            trimmedValue,
            normalizePhoneNumber,
            `Invalid phone number "${trimmedValue}"`
          )
          break
        // Assumption: the sample CSVs only provide "yearsInRole"; we treat years in the current role as
        // years at the current company, since it's the closest data point available.
        case 'yearsatcompany':
        case 'yearsincompany':
        case 'yearsinrole':
          lead.yearsAtCompany = validateOptional(
            trimmedValue,
            normalizeYearsAtCompany,
            `Invalid years at company "${trimmedValue}" (expected a whole number from 0 to ${MAX_YEARS_AT_COMPANY})`
          )
          break
        case 'linkedinurl':
        case 'linkedin':
        case 'linkedinprofile':
          lead.linkedinUrl = validateOptional(
            trimmedValue,
            normalizeLinkedinUrl,
            `Invalid LinkedIn URL "${trimmedValue}" (expected a linkedin.com URL)`
          )
          break
        case 'companywebsite':
        case 'website':
        case 'companydomain':
          lead.companyWebsite = validateOptional(
            trimmedValue,
            normalizeCompanyWebsite,
            `Invalid company website "${trimmedValue}"`
          )
          break
      }
    })

    const errors: string[] = []
    if (!lead.firstName?.trim()) {
      errors.push('First name is required')
    }
    if (!lead.lastName?.trim()) {
      errors.push('Last name is required')
    }
    if (!lead.email?.trim()) {
      errors.push('Email is required')
    } else if (!isValidEmail(lead.email)) {
      errors.push('Invalid email format')
    }

    data.push({
      ...lead,
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      email: lead.email || '',
      isValid: errors.length === 0,
      errors,
      warnings,
    } as CsvLead)
  })

  return data
}

/**
 * Normalizers/validators for optional lead fields. Each one returns the canonical value, or null when the
 * input is empty or invalid (callers decide whether an invalid value deserves a warning).
 *
 * NOTE: duplicated in frontend/src/utils/leadFieldValidators.ts (no shared package yet); keep both in sync.
 * The backend copy is the authoritative check: never trust client-side validation.
 */

export const MAX_YEARS_AT_COMPANY = 80

const MIN_PHONE_DIGITS = 7
const MAX_PHONE_DIGITS = 20

/**
 * Years at the current company, stored as whole years between 0 and MAX_YEARS_AT_COMPANY. Decimals are rounded
 * down ("2.5" -> 2) so tenure is never overstated.
 *
 * Future improvement: keep partial years. A decimal is ambiguous because months aren't base 10 ("2.6" may mean
 * 2 years and 6 months, or 2.6 years = 2 years and ~7 months), so it should be stored in an explicit unit such
 * as months rather than as a decimal number of years.
 */
export const normalizeYearsAtCompany = (value: unknown): number | null => {
  let years: number
  if (typeof value === 'number') {
    years = value
  } else if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim())) {
    years = Number(value.trim())
  } else {
    return null
  }
  if (!Number.isFinite(years) || years < 0) return null
  const wholeYears = Math.floor(years)
  return wholeYears <= MAX_YEARS_AT_COMPANY ? wholeYears : null
}

/**
 * Phone numbers are validated permissively since real-world formats vary a lot: digits, spaces, "+", "-",
 * "()", "." and an optional extension ("x123", "ext. 123"), with at least MIN_PHONE_DIGITS digits.
 * The value is stored as written (whitespace collapsed), not reformatted.
 */
export const normalizePhoneNumber = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const phone = value.trim().replace(/\s+/g, ' ')
  const match = phone.match(/^(\+?[\d\s\-().]+?)\s*(?:(?:x|ext\.?)\s*\d{1,6})?$/i)
  if (!match) return null
  const digitCount = match[1].replace(/\D/g, '').length
  return digitCount >= MIN_PHONE_DIGITS && digitCount <= MAX_PHONE_DIGITS ? phone : null
}

const parseHttpUrl = (value: string): URL | null => {
  const withScheme = /^[a-z][a-z\d+\-.]*:\/\//i.test(value) ? value : `https://${value}`
  try {
    const url = new URL(withScheme)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

const isValidHostname = (hostname: string): boolean =>
  hostname.length <= 253 && /^([a-z\d]([a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,63}$/.test(hostname)

/**
 * LinkedIn URLs must be http(s) URLs on linkedin.com (any subdomain, e.g. www. or es.) with a path.
 * A missing scheme is normalized to https ("linkedin.com/in/ada" -> "https://linkedin.com/in/ada").
 */
export const normalizeLinkedinUrl = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null
  const url = parseHttpUrl(value.trim())
  if (!url) return null
  const hostname = url.hostname.toLowerCase()
  const isLinkedin = hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com')
  if (!isLinkedin || url.pathname === '/' || url.username || url.password) return null
  return url.href
}

/**
 * Company websites are stored as a bare domain ("https://www.Acme.com/about" -> "acme.com"), which is what
 * enrichment providers expect.
 */
export const normalizeCompanyWebsite = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null
  const url = parseHttpUrl(value.trim())
  if (!url || url.username || url.password) return null
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '')
  return isValidHostname(hostname) ? hostname : null
}

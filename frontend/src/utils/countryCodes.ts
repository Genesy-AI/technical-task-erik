import { getAlpha2Codes } from 'i18n-iso-countries'

/**
 * ISO 3166-1 alpha-2 country codes, from the `i18n-iso-countries` package (also includes the
 * user-assigned "XK" for Kosovo, which is widely used in practice). The browser entry of the
 * package ships only the codes table; no locale data is loaded since we don't need country names.
 *
 * We build the set from getAlpha2Codes() instead of calling isValid(), because isValid() also
 * accepts alpha-3 ("ESP") and numeric ("724") codes, and the countryCode column holds alpha-2.
 *
 * NOTE: mirrored in backend/src/utils/countryCodes.ts (no shared package yet); keep both in sync.
 */
export const COUNTRY_CODES: ReadonlySet<string> = new Set(Object.keys(getAlpha2Codes()))

/**
 * Common non-ISO spellings mapped to their official code. "UK" is not assigned in ISO 3166-1 (it is
 * exceptionally reserved), but it is by far the most common way to write the United Kingdom, whose
 * official code is "GB".
 */
const COUNTRY_CODE_ALIASES: Readonly<Record<string, string>> = {
  UK: 'GB',
}

/**
 * Normalizes a raw country code (trim + uppercase + alias mapping) and validates it against
 * ISO 3166-1 alpha-2. Returns the canonical code, or null when the value is empty or invalid.
 */
export const normalizeCountryCode = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const upper = value.trim().toUpperCase()
  if (!upper) return null
  const code = COUNTRY_CODE_ALIASES[upper] ?? upper
  return COUNTRY_CODES.has(code) ? code : null
}

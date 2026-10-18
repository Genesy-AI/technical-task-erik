/**
 * ISO 3166-1 alpha-2 country codes (all 249 officially assigned codes).
 *
 * Source: tzdata's ISO 3166 table (/usr/share/zoneinfo/iso3166.tab, IANA tz database).
 * Regenerate the list with:
 *   grep -v '^#' /usr/share/zoneinfo/iso3166.tab | cut -f1 | sort | xargs
 *
 * NOTE: duplicated in backend/src/utils/countryCodes.ts (no shared package yet); keep both in sync.
 */
const ISO_3166_ALPHA2_CODES = `
  AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS
  BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE
  EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM
  HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC
  LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA
  NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW
  SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO
  TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW
`
  .split(/\s+/)
  .filter(Boolean)

export const COUNTRY_CODES: ReadonlySet<string> = new Set(ISO_3166_ALPHA2_CODES)

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

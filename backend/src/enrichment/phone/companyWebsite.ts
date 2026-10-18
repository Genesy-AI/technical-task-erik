// Webmail domains say nothing about the lead's employer, so they never stand in for a company website.
// Only the provider's own domain matches (gmail.com, yahoo.co.uk), never a company host like mail.acme.com.
const FREE_EMAIL_DOMAIN =
  /^(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|me|mac|aol|proton|protonmail|gmx|mail|yandex|zoho)\.(com|net|org|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/

/** `https://www.Acme.com/about` → `acme.com`. Returns null for anything that isn't a plausible domain. */
export function toBareDomain(value: string): string | null {
  const candidate = value.trim().toLowerCase()
  if (!candidate) return null
  try {
    const host = new URL(candidate.includes('://') ? candidate : `https://${candidate}`).hostname
    const domain = host.replace(/^www\./, '')
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) ? domain : null
  } catch {
    return null
  }
}

/**
 * Prefer the stored company website; otherwise fall back to the domain of a business email.
 * Returns null when neither is usable (e.g. a gmail address and no website).
 */
export function resolveCompanyWebsite(lead: {
  companyWebsite?: string | null
  email: string
}): string | null {
  if (lead.companyWebsite) {
    const domain = toBareDomain(lead.companyWebsite)
    if (domain) return domain
  }

  const emailDomain = lead.email.split('@')[1]
  if (!emailDomain) return null
  const domain = toBareDomain(emailDomain)
  return domain && !FREE_EMAIL_DOMAIN.test(domain) ? domain : null
}

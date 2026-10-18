export type LeadUpdateData = { firstName?: string; email?: string }

/**
 * Validates a partial lead update body. Only fields that are present are updated, so a missing field can
 * never be written as the string "undefined". `name` is accepted as an alias of `firstName` (same as
 * POST /leads).
 */
export function parseLeadUpdate(body: unknown): { data: LeadUpdateData } | { error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body is required and must be a JSON object' }
  }

  const { firstName, name, email } = body as Record<string, unknown>
  const data: LeadUpdateData = {}

  const nextFirstName = firstName ?? name
  if (nextFirstName !== undefined) {
    if (typeof nextFirstName !== 'string' || !nextFirstName.trim()) {
      return { error: 'firstName must be a non-empty string' }
    }
    data.firstName = nextFirstName.trim()
  }

  if (email !== undefined) {
    if (typeof email !== 'string' || !email.trim()) {
      return { error: 'email must be a non-empty string' }
    }
    data.email = email.trim()
  }

  if (Object.keys(data).length === 0) {
    return { error: 'Provide at least one of firstName or email' }
  }
  return { data }
}

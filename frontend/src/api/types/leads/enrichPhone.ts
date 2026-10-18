export type LeadsEnrichPhoneInput = {
  leadIds: number[]
}

/** Enrichment runs in the background; progress arrives as `lead.updated` events on `/leads/events`. */
export type LeadsEnrichPhoneOutput = {
  queued: number[]
  skipped: Array<{
    leadId: number
    reason: 'NOT_FOUND' | 'ALREADY_PENDING' | 'HAS_PHONE'
  }>
  errors: Array<{
    leadId: number
    error: string
  }>
}

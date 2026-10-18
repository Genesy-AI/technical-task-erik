export type LeadsVerifyEmailsInput = {
  leadIds: number[]
}

/** Verification runs in the background; results arrive as `lead.updated` events on `/leads/events`. */
export type LeadsVerifyEmailsOutput = {
  queued: number[]
  skipped: Array<{
    leadId: number
    reason: 'NOT_FOUND' | 'ALREADY_PENDING'
  }>
  errors: Array<{
    leadId: number
    error: string
  }>
}

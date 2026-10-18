import { WorkflowIdConflictPolicy } from '@temporalio/client'
import { config } from '../config'
import { prisma } from '../db'
import { getTemporalClient } from '../temporal/client'
import { verifyEmailWorkflow } from '../workflows'
import { transitionEmailVerificationStatus } from './emailVerificationStore'

export type StartEmailVerificationResult = {
  /** Leads moved to PENDING with a verification workflow started for them. */
  queued: number[]
  /** Leads that were not queued, and why. */
  skipped: Array<{ leadId: number; reason: 'NOT_FOUND' | 'ALREADY_PENDING' }>
  /** Leads whose workflow could not be started; they are marked FAILED so the user can retry. */
  errors: Array<{ leadId: number; error: string }>
}

/** One workflow per lead: the id is stable so repeated requests can never run two verifications at once. */
export const verifyEmailWorkflowId = (leadId: number) => `verify-email-${leadId}`

/**
 * Queues email verification for the given leads and returns without waiting for the results; outcomes are
 * persisted by the workflow and pushed to clients as `lead.updated` events.
 */
export async function startEmailVerification(leadIds: number[]): Promise<StartEmailVerificationResult> {
  const result: StartEmailVerificationResult = { queued: [], skipped: [], errors: [] }

  const leads = await prisma.lead.findMany({ where: { id: { in: leadIds } } })
  const leadsById = new Map(leads.map((lead) => [lead.id, lead]))
  const client = await getTemporalClient()

  for (const leadId of leadIds) {
    const lead = leadsById.get(leadId)
    if (!lead) {
      result.skipped.push({ leadId, reason: 'NOT_FOUND' })
      continue
    }

    // Conditional update: if another request got there first, the lead is already PENDING.
    const pending = await transitionEmailVerificationStatus(lead.id, 'PENDING')

    try {
      // USE_EXISTING makes this idempotent: if a verification for this lead is still running, Temporal
      // returns it instead of starting a duplicate. For leads already PENDING this is a no-op in the normal
      // case, and restarts the verification if its workflow was somehow lost.
      await client.workflow.start(verifyEmailWorkflow, {
        taskQueue: config.temporal.taskQueue,
        workflowId: verifyEmailWorkflowId(lead.id),
        workflowIdConflictPolicy: WorkflowIdConflictPolicy.USE_EXISTING,
        args: [{ leadId: lead.id, email: lead.email }],
      })
    } catch (error) {
      console.error(`Failed to start email verification for lead ${lead.id}:`, error)
      if (pending) await transitionEmailVerificationStatus(lead.id, 'FAILED')
      result.errors.push({
        leadId: lead.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      continue
    }

    if (pending) {
      result.queued.push(lead.id)
    } else {
      result.skipped.push({ leadId: lead.id, reason: 'ALREADY_PENDING' })
    }
  }

  return result
}

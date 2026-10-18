import { WorkflowIdConflictPolicy } from '@temporalio/client'
import { config } from '../config'
import { prisma } from '../db'
import { getTemporalClient } from '../temporal/client'
import { enrichPhoneWorkflow } from '../workflows'
import { transitionPhoneEnrichmentStatus } from './phoneEnrichmentStore'

export type StartPhoneEnrichmentResult = {
  /** Leads moved to PENDING with an enrichment workflow started for them. */
  queued: number[]
  /** Leads that were not queued, and why. */
  skipped: Array<{ leadId: number; reason: 'NOT_FOUND' | 'ALREADY_PENDING' | 'HAS_PHONE' }>
  /** Leads whose workflow could not be started; they are marked FAILED so the user can retry. */
  errors: Array<{ leadId: number; error: string }>
}

/** One workflow per lead: the id is stable so repeated requests can never run two enrichments at once. */
export const enrichPhoneWorkflowId = (leadId: number) => `enrich-phone-${leadId}`

/**
 * Queues phone enrichment for the given leads and returns without waiting; progress and outcomes are
 * persisted by the workflow and pushed to clients as `lead.updated` events.
 *
 * Leads that already have a phone (imported or previously found) are skipped: we never overwrite it.
 */
export async function startPhoneEnrichment(leadIds: number[]): Promise<StartPhoneEnrichmentResult> {
  const result: StartPhoneEnrichmentResult = { queued: [], skipped: [], errors: [] }

  const leads = await prisma.lead.findMany({ where: { id: { in: leadIds } } })
  const leadsById = new Map(leads.map((lead) => [lead.id, lead]))
  const client = await getTemporalClient()

  for (const leadId of leadIds) {
    const lead = leadsById.get(leadId)
    if (!lead) {
      result.skipped.push({ leadId, reason: 'NOT_FOUND' })
      continue
    }
    if (lead.phoneNumber) {
      result.skipped.push({ leadId, reason: 'HAS_PHONE' })
      continue
    }

    // Conditional update: refused if another request got there first (lead already PENDING), or if the
    // lead gained a phone or was deleted since we read it.
    const pending = await transitionPhoneEnrichmentStatus(lead.id, 'PENDING')
    if (!pending) {
      const current = await prisma.lead.findUnique({ where: { id: lead.id } })
      if (!current) {
        result.skipped.push({ leadId, reason: 'NOT_FOUND' })
        continue
      }
      if (current.phoneEnrichmentStatus !== 'PENDING') {
        // Never start a workflow whose result could not be persisted: it would only burn provider calls.
        result.skipped.push({ leadId, reason: 'HAS_PHONE' })
        continue
      }
    }

    try {
      // USE_EXISTING: if an enrichment for this lead is still running, Temporal returns it instead of
      // starting a duplicate. For leads already PENDING this restarts the workflow only if it was lost.
      await client.workflow.start(enrichPhoneWorkflow, {
        taskQueue: config.temporal.taskQueue,
        workflowId: enrichPhoneWorkflowId(lead.id),
        workflowIdConflictPolicy: WorkflowIdConflictPolicy.USE_EXISTING,
        args: [{ leadId: lead.id }],
      })
    } catch (error) {
      console.error(`Failed to start phone enrichment for lead ${lead.id}:`, error)
      if (pending) await transitionPhoneEnrichmentStatus(lead.id, 'FAILED')
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

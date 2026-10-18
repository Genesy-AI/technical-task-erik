import type { lead, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { leadEvents } from '../events/leadEvents'
import type { PhoneProviderId } from '../enrichment/phone/constants'
import { PhoneEnrichmentStatus, phoneEnrichmentSourceStates } from './phoneEnrichmentStatus'

function sourceStateFilter(to: PhoneEnrichmentStatus): Prisma.leadWhereInput {
  const sources = phoneEnrichmentSourceStates(to)
  const nonNull = sources.filter((state): state is PhoneEnrichmentStatus => state !== null)
  return {
    OR: [
      { phoneEnrichmentStatus: { in: nonNull } },
      ...(sources.includes(null) ? [{ phoneEnrichmentStatus: null }] : []),
    ],
  }
}

/** Leads with a phone (imported, typed in or previously found) are never enriched again. */
const HAS_NO_PHONE: Prisma.leadWhereInput = { OR: [{ phoneNumber: null }, { phoneNumber: '' }] }

function transitionGuard(to: PhoneEnrichmentStatus): Prisma.leadWhereInput {
  const states = sourceStateFilter(to)
  return to === 'PENDING' ? { AND: [states, HAS_NO_PHONE] } : states
}

async function updateAndPublish(
  leadId: number,
  guard: Prisma.leadWhereInput,
  data: Prisma.leadUpdateManyMutationInput
): Promise<lead | null> {
  const { count } = await prisma.lead.updateMany({ where: { id: leadId, ...guard }, data })
  if (count === 0) return null

  const updated = await prisma.lead.findUnique({ where: { id: leadId } })
  if (updated) leadEvents.publishLeadUpdated(updated)
  return updated
}

/**
 * Moves a lead to `to` only if the transition is allowed from its current state (and, for PENDING, the
 * lead has no phone), in a single conditional UPDATE so concurrent callers cannot both win. Publishes
 * `lead.updated` on success.
 *
 * Returns the updated lead, or `null` when the lead does not exist or the transition is not allowed.
 */
export function transitionPhoneEnrichmentStatus(
  leadId: number,
  to: PhoneEnrichmentStatus,
  details: { phoneNumber?: string; provider?: PhoneProviderId | null } = {}
): Promise<lead | null> {
  return updateAndPublish(leadId, transitionGuard(to), {
    phoneEnrichmentStatus: to,
    phoneEnrichmentProvider: details.provider ?? null,
    ...(details.phoneNumber ? { phoneNumber: details.phoneNumber } : {}),
  })
}

/** Records which provider is being queried right now, so the UI can show progress. PENDING leads only. */
export function setPhoneEnrichmentProgress(leadId: number, provider: PhoneProviderId): Promise<lead | null> {
  return updateAndPublish(leadId, { phoneEnrichmentStatus: 'PENDING' }, { phoneEnrichmentProvider: provider })
}

import type { lead, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { leadEvents } from '../events/leadEvents'
import { EmailVerificationStatus, emailVerificationSourceStates } from './emailVerificationStatus'

function sourceStateFilter(to: EmailVerificationStatus): Prisma.leadWhereInput {
  const sources = emailVerificationSourceStates(to)
  const nonNull = sources.filter((state): state is EmailVerificationStatus => state !== null)
  return {
    OR: [
      { emailVerificationStatus: { in: nonNull } },
      ...(sources.includes(null) ? [{ emailVerificationStatus: null }] : []),
    ],
  }
}

/**
 * Moves a lead to `to` only if the transition is allowed from its current state. The check and the write
 * happen in a single conditional UPDATE, so concurrent callers cannot both win the same transition.
 *
 * Publishes `lead.updated` on success. Returns the updated lead, or `null` when the lead does not exist or
 * its current state does not allow the transition.
 */
export async function transitionEmailVerificationStatus(
  leadId: number,
  to: EmailVerificationStatus
): Promise<lead | null> {
  const { count } = await prisma.lead.updateMany({
    where: { id: leadId, ...sourceStateFilter(to) },
    data: { emailVerificationStatus: to },
  })
  if (count === 0) return null

  const updated = await prisma.lead.findUnique({ where: { id: leadId } })
  if (updated) leadEvents.publishLeadUpdated(updated)
  return updated
}

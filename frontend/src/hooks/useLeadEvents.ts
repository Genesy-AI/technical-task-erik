import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Lead, LeadsGetManyOutput } from '../api/types/leads/getMany'

const LEADS_QUERY_KEY = ['leads', 'getMany']

/** Replaces the matching lead in the list; returns `undefined` when the lead is not in the list. */
export function applyLeadUpdate(
  leads: LeadsGetManyOutput | undefined,
  updated: Lead
): LeadsGetManyOutput | undefined {
  if (!leads?.some((lead) => lead.id === updated.id)) return undefined
  return leads.map((lead) => (lead.id === updated.id ? updated : lead))
}

/**
 * Marks queued leads as PENDING, but only those not updated since the request was sent (`updatedAtBefore`).
 * A lead whose verification finishes before the HTTP response arrives has already been patched by a
 * `lead.updated` event; overwriting it with PENDING would leave it stuck, since no further event follows.
 */
export function markQueuedLeadsPending(
  leads: LeadsGetManyOutput | undefined,
  queuedIds: number[],
  updatedAtBefore: Map<number, string>
): LeadsGetManyOutput | undefined {
  const queued = new Set(queuedIds)
  return leads?.map((lead) =>
    queued.has(lead.id) && lead.updatedAt === updatedAtBefore.get(lead.id)
      ? { ...lead, emailVerificationStatus: 'PENDING' }
      : lead
  )
}

/**
 * Subscribes to server-sent lead updates (e.g. email verification progress) and patches the leads cache
 * in place, so the table updates without refetching. Mount once.
 */
export function useLeadEvents() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const source = new EventSource(`${import.meta.env.VITE_API_URL}/leads/events`)
    let hasConnected = false

    const handleOpen = () => {
      // Events are not replayed while disconnected: resync after every reconnect.
      if (hasConnected) queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEY })
      hasConnected = true
    }

    const handleLeadUpdated = (event: MessageEvent<string>) => {
      const updated = JSON.parse(event.data) as Lead
      const leads = queryClient.getQueryData<LeadsGetManyOutput>(LEADS_QUERY_KEY)
      const next = applyLeadUpdate(leads, updated)
      if (next) {
        queryClient.setQueryData<LeadsGetManyOutput>(LEADS_QUERY_KEY, next)
      } else if (leads) {
        // A lead we have not loaded yet (e.g. created in another tab).
        queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEY })
      }
    }

    source.addEventListener('open', handleOpen)
    source.addEventListener('lead.updated', handleLeadUpdated)

    return () => {
      source.removeEventListener('open', handleOpen)
      source.removeEventListener('lead.updated', handleLeadUpdated)
      source.close()
    }
  }, [queryClient])
}

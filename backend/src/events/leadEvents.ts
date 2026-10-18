import { EventEmitter } from 'events'
import type { lead } from '@prisma/client'

export type LeadUpdatedListener = (lead: lead) => void

export interface LeadEventBus {
  publishLeadUpdated(lead: lead): void
  /** Returns an unsubscribe function. */
  subscribe(listener: LeadUpdatedListener): () => void
}

const LEAD_UPDATED = 'lead.updated'

/**
 * In-process implementation backed by Node's EventEmitter.
 *
 * Limitation: events only reach subscribers in the same Node process. This works today because the
 * Temporal worker (which publishes from activities) runs inside the API process (`runTemporalWorker()`
 * in index.ts). Once the worker is split out or the API is scaled to several instances, swap this for a
 * cross-process implementation of `LeadEventBus` (e.g. Redis pub/sub or Postgres LISTEN/NOTIFY); callers
 * only depend on the interface, so nothing else has to change.
 */
class InProcessLeadEventBus implements LeadEventBus {
  private readonly emitter = new EventEmitter()

  constructor() {
    // Every open SSE connection is a listener; the default cap of 10 would only produce noisy warnings.
    this.emitter.setMaxListeners(0)
  }

  publishLeadUpdated(lead: lead): void {
    this.emitter.emit(LEAD_UPDATED, lead)
  }

  subscribe(listener: LeadUpdatedListener): () => void {
    this.emitter.on(LEAD_UPDATED, listener)
    return () => {
      this.emitter.off(LEAD_UPDATED, listener)
    }
  }
}

export const leadEvents: LeadEventBus = new InProcessLeadEventBus()

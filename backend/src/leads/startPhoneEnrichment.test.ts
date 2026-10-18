import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findMany, findUnique, start, transition } = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  start: vi.fn(),
  transition: vi.fn(),
}))

vi.mock('../db', () => ({ prisma: { lead: { findMany, findUnique } } }))
vi.mock('../temporal/client', () => ({
  getTemporalClient: async () => ({ workflow: { start } }),
}))
vi.mock('../workflows', () => ({ enrichPhoneWorkflow: 'enrichPhoneWorkflow' }))
vi.mock('./phoneEnrichmentStore', () => ({ transitionPhoneEnrichmentStatus: transition }))

import { startPhoneEnrichment } from './startPhoneEnrichment'

type TestLead = { id: number; phoneNumber: string | null; phoneEnrichmentStatus: string | null }
const lead = (overrides: Partial<TestLead> = {}): TestLead => ({
  id: 1,
  phoneNumber: null,
  phoneEnrichmentStatus: null,
  ...overrides,
})

describe('startPhoneEnrichment', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    start.mockResolvedValue(undefined)
  })

  it('queues a lead without a phone and starts its workflow', async () => {
    findMany.mockResolvedValue([lead()])
    transition.mockResolvedValue({ ...lead(), phoneEnrichmentStatus: 'PENDING' })

    await expect(startPhoneEnrichment([1])).resolves.toEqual({ queued: [1], skipped: [], errors: [] })
    expect(start).toHaveBeenCalledOnce()
  })

  it('skips unknown leads and leads that already have a phone without touching Temporal', async () => {
    findMany.mockResolvedValue([lead({ id: 2, phoneNumber: '600111222' })])

    await expect(startPhoneEnrichment([1, 2])).resolves.toEqual({
      queued: [],
      skipped: [
        { leadId: 1, reason: 'NOT_FOUND' },
        { leadId: 2, reason: 'HAS_PHONE' },
      ],
      errors: [],
    })
    expect(transition).not.toHaveBeenCalled()
    expect(start).not.toHaveBeenCalled()
  })

  it('re-ensures the workflow for a lead that is already PENDING (recovers a lost workflow)', async () => {
    findMany.mockResolvedValue([lead({ phoneEnrichmentStatus: 'PENDING' })])
    transition.mockResolvedValue(null)
    findUnique.mockResolvedValue(lead({ phoneEnrichmentStatus: 'PENDING' }))

    await expect(startPhoneEnrichment([1])).resolves.toEqual({
      queued: [],
      skipped: [{ leadId: 1, reason: 'ALREADY_PENDING' }],
      errors: [],
    })
    expect(start).toHaveBeenCalledOnce()
  })

  it('does not start a workflow when the transition is refused because the lead gained a phone', async () => {
    findMany.mockResolvedValue([lead({ phoneEnrichmentStatus: 'FOUND' })])
    transition.mockResolvedValue(null)
    findUnique.mockResolvedValue(lead({ phoneNumber: '600111222', phoneEnrichmentStatus: 'FOUND' }))

    await expect(startPhoneEnrichment([1])).resolves.toEqual({
      queued: [],
      skipped: [{ leadId: 1, reason: 'HAS_PHONE' }],
      errors: [],
    })
    expect(start).not.toHaveBeenCalled()
  })

  it('reports NOT_FOUND when the lead is deleted between read and transition', async () => {
    findMany.mockResolvedValue([lead()])
    transition.mockResolvedValue(null)
    findUnique.mockResolvedValue(null)

    await expect(startPhoneEnrichment([1])).resolves.toEqual({
      queued: [],
      skipped: [{ leadId: 1, reason: 'NOT_FOUND' }],
      errors: [],
    })
    expect(start).not.toHaveBeenCalled()
  })

  it('marks the lead FAILED when Temporal refuses to start the workflow', async () => {
    findMany.mockResolvedValue([lead()])
    transition.mockResolvedValue({ ...lead(), phoneEnrichmentStatus: 'PENDING' })
    start.mockRejectedValue(new Error('temporal down'))

    await expect(startPhoneEnrichment([1])).resolves.toEqual({
      queued: [],
      skipped: [],
      errors: [{ leadId: 1, error: 'temporal down' }],
    })
    expect(transition).toHaveBeenLastCalledWith(1, 'FAILED')
  })
})

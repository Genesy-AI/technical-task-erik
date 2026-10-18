import { ApplicationFailure } from '@temporalio/common'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { DefaultLogger, Runtime, Worker } from '@temporalio/worker'
import path from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  PHONE_PROVIDER_ERROR_TYPES,
  PHONE_PROVIDER_IDS,
  PhoneProviderId,
  phoneProviderTaskQueue,
} from '../enrichment/phone/constants'
import { PhoneLookupResult } from '../enrichment/phone/types'
import type * as activities from './activities'
import { enrichPhoneWorkflow } from './enrichPhoneWorkflow'

const TASK_QUEUE = 'enrich-phone-workflow-test'

const input = { fullName: 'Ada Lovelace', email: 'ada@acme.com', jobTitle: 'CTO', companyWebsite: 'acme.com' }

type ProviderBehaviour = (attempt: number) => Promise<PhoneLookupResult>
const noData: ProviderBehaviour = async () => ({ status: 'no_data' })
const found =
  (phone: string): ProviderBehaviour =>
  async () => ({ status: 'found', phone })
const alwaysDown: ProviderBehaviour = async () => {
  throw ApplicationFailure.retryable('HTTP 500', PHONE_PROVIDER_ERROR_TYPES.UNAVAILABLE)
}

describe('enrichPhoneWorkflow', () => {
  let testEnv: TestWorkflowEnvironment

  beforeAll(async () => {
    Runtime.install({ logger: new DefaultLogger('WARN') })
    testEnv = await TestWorkflowEnvironment.createTimeSkipping()
  }, 120_000)

  afterAll(async () => {
    await testEnv?.teardown()
  })

  async function run(
    behaviours: Partial<Record<PhoneProviderId, ProviderBehaviour>>,
    plannedProviders: PhoneProviderId[] = [...PHONE_PROVIDER_IDS]
  ) {
    const calls: Record<PhoneProviderId, number> = { orionConnect: 0, astraDialer: 0, nimbusLookup: 0 }
    const completePhoneEnrichment = vi.fn<typeof activities.completePhoneEnrichment>(async () => {})
    const reportPhoneEnrichmentProgress = vi.fn<typeof activities.reportPhoneEnrichmentProgress>(
      async () => {}
    )
    const planPhoneEnrichment = vi.fn<typeof activities.planPhoneEnrichment>(async () => ({
      input,
      providers: plannedProviders,
      skipped: [],
    }))

    const lookupPhone: typeof activities.lookupPhone = async (providerId) => {
      calls[providerId] += 1
      const behaviour = behaviours[providerId]
      if (!behaviour) throw new Error(`unexpected call to ${providerId}`)
      return behaviour(calls[providerId])
    }

    const mainWorker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: TASK_QUEUE,
      workflowsPath: path.join(__dirname, 'enrichPhoneWorkflow.ts'),
      activities: { planPhoneEnrichment, reportPhoneEnrichmentProgress, completePhoneEnrichment },
    })
    const providerWorkers = await Promise.all(
      PHONE_PROVIDER_IDS.map((providerId) =>
        Worker.create({
          connection: testEnv.nativeConnection,
          taskQueue: phoneProviderTaskQueue(TASK_QUEUE, providerId),
          activities: { lookupPhone },
        })
      )
    )

    const execution = testEnv.client.workflow.execute(enrichPhoneWorkflow, {
      taskQueue: TASK_QUEUE,
      workflowId: `enrich-phone-test-${Math.random()}`,
      args: [{ leadId: 7 }],
    })
    // Run every worker until the workflow completes.
    const outcome = await providerWorkers.reduce<Promise<Awaited<typeof execution>>>(
      (promise, worker) => worker.runUntil(promise),
      mainWorker.runUntil(execution)
    )
    return { outcome, calls, completePhoneEnrichment, reportPhoneEnrichmentProgress }
  }

  it('stops at the first provider that finds a phone', async () => {
    const { outcome, calls, completePhoneEnrichment } = await run({ orionConnect: found('111') })

    expect(outcome).toEqual({ status: 'FOUND', phoneNumber: '111', provider: 'orionConnect' })
    expect(calls).toEqual({ orionConnect: 1, astraDialer: 0, nimbusLookup: 0 })
    expect(completePhoneEnrichment).toHaveBeenCalledWith(7, outcome)
  })

  it('falls through the waterfall in order and reports progress per provider', async () => {
    const { outcome, reportPhoneEnrichmentProgress } = await run({
      orionConnect: noData,
      astraDialer: noData,
      nimbusLookup: found('333'),
    })

    expect(outcome).toEqual({ status: 'FOUND', phoneNumber: '333', provider: 'nimbusLookup' })
    expect(reportPhoneEnrichmentProgress.mock.calls.map(([, providerId]) => providerId)).toEqual([
      'orionConnect',
      'astraDialer',
      'nimbusLookup',
    ])
  })

  it('marks NOT_FOUND when every provider answers without data', async () => {
    const { outcome, completePhoneEnrichment } = await run({
      orionConnect: noData,
      astraDialer: noData,
      nimbusLookup: noData,
    })

    expect(outcome).toEqual({ status: 'NOT_FOUND' })
    expect(completePhoneEnrichment).toHaveBeenCalledWith(7, { status: 'NOT_FOUND' })
  })

  it('retries a failing provider 3 times, then moves on', async () => {
    const { outcome, calls } = await run({
      orionConnect: alwaysDown,
      astraDialer: found('222'),
    })

    expect(calls.orionConnect).toBe(3)
    expect(outcome).toEqual({ status: 'FOUND', phoneNumber: '222', provider: 'astraDialer' })
  })

  it('recovers when a retry succeeds', async () => {
    const { outcome, calls } = await run({
      orionConnect: (attempt) => (attempt < 2 ? alwaysDown(attempt) : found('111')(attempt)),
    })

    expect(calls.orionConnect).toBe(2)
    expect(outcome).toEqual({ status: 'FOUND', phoneNumber: '111', provider: 'orionConnect' })
  })

  it('marks FAILED (retryable by the user) when a provider kept failing and nobody found a phone', async () => {
    const { outcome } = await run({ orionConnect: alwaysDown, astraDialer: noData, nimbusLookup: noData })
    expect(outcome).toEqual({ status: 'FAILED' })
  })

  it('does not retry rejected requests', async () => {
    const { calls } = await run({
      orionConnect: async () => {
        throw ApplicationFailure.nonRetryable('HTTP 401', PHONE_PROVIDER_ERROR_TYPES.REJECTED)
      },
      astraDialer: noData,
      nimbusLookup: noData,
    })
    expect(calls.orionConnect).toBe(1)
  })

  it('only queries the providers in the plan', async () => {
    const { calls, outcome } = await run({ astraDialer: noData }, ['astraDialer'])

    expect(calls).toEqual({ orionConnect: 0, astraDialer: 1, nimbusLookup: 0 })
    expect(outcome).toEqual({ status: 'NOT_FOUND' })
  })
})

import { TestWorkflowEnvironment } from '@temporalio/testing'
import { Runtime, DefaultLogger, Worker } from '@temporalio/worker'
import path from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type * as activities from './activities'
import { verifyEmailWorkflow, VERIFY_EMAIL_RETRY_POLICY } from './workflows'

const TASK_QUEUE = 'verify-email-workflow-test'
/** Longer than VERIFY_EMAIL_START_TO_CLOSE_TIMEOUT (5s). */
const SLOW_PROVIDER_MS = 6_000

describe('verifyEmailWorkflow', () => {
  let testEnv: TestWorkflowEnvironment

  beforeAll(async () => {
    Runtime.install({ logger: new DefaultLogger('WARN') })
    testEnv = await TestWorkflowEnvironment.createTimeSkipping()
  }, 120_000)

  afterAll(async () => {
    await testEnv?.teardown()
  })

  async function run(verifyEmail: typeof activities.verifyEmail) {
    const setEmailVerificationStatus = vi.fn<typeof activities.setEmailVerificationStatus>(async () => {})
    const verifyEmailSpy = vi.fn(verifyEmail)
    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: TASK_QUEUE,
      workflowsPath: path.join(__dirname, 'workflows.ts'),
      activities: { verifyEmail: verifyEmailSpy, setEmailVerificationStatus },
    })

    const outcome = await worker.runUntil(
      testEnv.client.workflow.execute(verifyEmailWorkflow, {
        taskQueue: TASK_QUEUE,
        workflowId: `verify-email-test-${Math.random()}`,
        args: [{ leadId: 42, email: 'someone@example.com' }],
      })
    )
    return { outcome, verifyEmailSpy, setEmailVerificationStatus }
  }

  it('persists VERIFIED when the provider accepts the email', async () => {
    const { outcome, setEmailVerificationStatus } = await run(async () => true)

    expect(outcome).toBe('VERIFIED')
    expect(setEmailVerificationStatus).toHaveBeenCalledWith(42, 'VERIFIED')
  })

  it('persists INVALID when the provider rejects the email', async () => {
    const { outcome, setEmailVerificationStatus } = await run(async () => false)

    expect(outcome).toBe('INVALID')
    expect(setEmailVerificationStatus).toHaveBeenCalledWith(42, 'INVALID')
  })

  it('persists FAILED after a bounded number of attempts when the provider keeps failing', async () => {
    const { outcome, verifyEmailSpy, setEmailVerificationStatus } = await run(async () => {
      throw new Error('provider unavailable')
    })

    expect(outcome).toBe('FAILED')
    expect(verifyEmailSpy).toHaveBeenCalledTimes(VERIFY_EMAIL_RETRY_POLICY.maximumAttempts!)
    expect(setEmailVerificationStatus).toHaveBeenCalledWith(42, 'FAILED')
  })

  it('persists FAILED when every attempt exceeds the start-to-close timeout', async () => {
    // Answers only after the start-to-close timeout has expired, like the slow `jane.smith` provider stub.
    // (It must eventually settle: the worker waits for in-flight activities before shutting down.)
    const { outcome, verifyEmailSpy, setEmailVerificationStatus } = await run(
      () => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), SLOW_PROVIDER_MS))
    )

    expect(outcome).toBe('FAILED')
    expect(verifyEmailSpy).toHaveBeenCalledTimes(VERIFY_EMAIL_RETRY_POLICY.maximumAttempts!)
    expect(setEmailVerificationStatus).toHaveBeenCalledWith(42, 'FAILED')
  }, 60_000)
})

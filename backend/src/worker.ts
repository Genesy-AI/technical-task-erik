import { NativeConnection, Worker } from '@temporalio/worker'
import { config } from './config'
import { PHONE_PROVIDER_IDS, phoneProviderTaskQueue } from './enrichment/phone/constants'
import * as activities from './workflows/activities'

export async function runTemporalWorker() {
  const connection = await NativeConnection.connect({
    address: config.temporal.address,
  })
  try {
    const mainWorker = await Worker.create({
      connection,
      namespace: config.temporal.namespace,
      taskQueue: config.temporal.taskQueue,
      workflowsPath: require.resolve('./workflows'),
      activities,
    })

    // One activity-only worker per phone provider: its task queue carries that provider's rate limit,
    // enforced by the Temporal server across all workers polling it. The limit holds on average but the
    // server releases tasks in bursts; 429s from a burst are retried after Retry-After (see http.ts).
    const phoneProviderWorkers = await Promise.all(
      PHONE_PROVIDER_IDS.map((providerId) =>
        Worker.create({
          connection,
          namespace: config.temporal.namespace,
          taskQueue: phoneProviderTaskQueue(config.temporal.taskQueue, providerId),
          activities: { lookupPhone: activities.lookupPhone },
          maxTaskQueueActivitiesPerSecond: config.phoneProviderMaxRps[providerId],
        })
      )
    )

    await Promise.all([mainWorker, ...phoneProviderWorkers].map((worker) => worker.run()))
  } finally {
    await connection.close()
  }
}

import { NativeConnection, Worker } from '@temporalio/worker'
import { config } from './config'
import * as activities from './workflows/activities'

export async function runTemporalWorker() {
  const connection = await NativeConnection.connect({
    address: config.temporal.address,
  })
  try {
    const worker = await Worker.create({
      connection,
      namespace: config.temporal.namespace,
      taskQueue: config.temporal.taskQueue,
      workflowsPath: require.resolve('./workflows'),
      activities,
    })

    await worker.run()
  } finally {
    await connection.close()
  }
}

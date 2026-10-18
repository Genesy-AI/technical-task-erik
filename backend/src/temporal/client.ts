import { Client, Connection } from '@temporalio/client'
import { config } from '../config'

let clientPromise: Promise<Client> | undefined

/**
 * Lazily connects to Temporal once and reuses the client for every request.
 * A failed connection attempt is not cached, so the next call retries.
 */
export function getTemporalClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = Connection.connect({ address: config.temporal.address })
      .then((connection) => new Client({ connection, namespace: config.temporal.namespace }))
      .catch((error) => {
        clientPromise = undefined
        throw error
      })
  }
  return clientPromise
}

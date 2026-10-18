import type { Request, Response } from 'express'
import { leadEvents } from './leadEvents'

const HEARTBEAT_INTERVAL_MS = 15_000
/** How long the browser's EventSource waits before reconnecting after the stream drops. */
const CLIENT_RETRY_MS = 3_000

/**
 * `GET /leads/events`: Server-Sent Events stream pushing every lead update as a `lead.updated` event whose
 * data is the full lead as JSON. Clients are expected to resync (refetch) after a reconnect, since events
 * emitted while disconnected are not replayed.
 */
export function streamLeadEvents(req: Request, res: Response) {
  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  // Disable response buffering in reverse proxies such as nginx.
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  res.write(`retry: ${CLIENT_RETRY_MS}\n\n`)

  const unsubscribe = leadEvents.subscribe((lead) => {
    res.write(`event: lead.updated\ndata: ${JSON.stringify(lead)}\n\n`)
  })

  // Comment lines keep idle connections from being closed by proxies/load balancers.
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n')
  }, HEARTBEAT_INTERVAL_MS)

  req.on('close', () => {
    clearInterval(heartbeat)
    unsubscribe()
  })
}

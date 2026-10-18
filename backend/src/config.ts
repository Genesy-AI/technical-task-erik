function readPort(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback
  const port = Number(value)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT "${value}": expected an integer between 1 and 65535`)
  }
  return port
}

export const config = {
  port: readPort(process.env.PORT, 4000),
  temporal: {
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    namespace: 'default',
    taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'myQueue',
  },
} as const

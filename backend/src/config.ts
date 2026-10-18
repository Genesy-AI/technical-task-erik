import { existsSync } from 'fs'
import path from 'path'
import { PhoneProviderId } from './enrichment/phone/constants'
import { PhoneProvidersConfig } from './enrichment/phone/types'

// Secrets live in backend/.env (git-ignored, see .env.sample). Real env vars take precedence.
const envFile = path.resolve(__dirname, '../.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)

function readPort(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback
  const port = Number(value)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT "${value}": expected an integer between 1 and 65535`)
  }
  return port
}

/** Optional positive number; unset means "no limit". */
function readRate(name: string): number | undefined {
  const value = process.env[name]
  if (value === undefined || value === '') return undefined
  const rate = Number(value)
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid ${name} "${value}": expected a positive number`)
  }
  return rate
}

const PHONE_API_BASE_URL = 'https://api.enginy.ai/api/tmp'

const phoneProviders: PhoneProvidersConfig = {
  orionConnect: {
    baseUrl: process.env.ORION_CONNECT_URL || `${PHONE_API_BASE_URL}/orionConnect`,
    apiKey: process.env.ORION_CONNECT_API_KEY || '',
  },
  astraDialer: {
    baseUrl: process.env.ASTRA_DIALER_URL || `${PHONE_API_BASE_URL}/astraDialer`,
    apiKey: process.env.ASTRA_DIALER_API_KEY || '',
  },
  nimbusLookup: {
    baseUrl: process.env.NIMBUS_LOOKUP_URL || `${PHONE_API_BASE_URL}/numbusLookup`,
    apiKey: process.env.NIMBUS_LOOKUP_API_KEY || '',
  },
}

/** Max provider calls per second across all workers (Temporal task-queue rate limit). */
const phoneProviderMaxRps: Record<PhoneProviderId, number | undefined> = {
  orionConnect: readRate('ORION_CONNECT_MAX_RPS'),
  astraDialer: readRate('ASTRA_DIALER_MAX_RPS'),
  nimbusLookup: readRate('NIMBUS_LOOKUP_MAX_RPS'),
}

export const config = {
  port: readPort(process.env.PORT, 4000),
  temporal: {
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    namespace: 'default',
    taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'myQueue',
  },
  phoneProviders,
  phoneProviderMaxRps,
} as const

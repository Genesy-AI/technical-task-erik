import { ApplicationFailure } from '@temporalio/common'
import { PHONE_PROVIDER_ERROR_TYPES, PhoneProviderId } from './constants'

export type FetchFn = typeof fetch

interface PostJsonRequest {
  url: string
  body: unknown
  headers?: Record<string, string>
  timeoutMs: number
}

/**
 * POSTs JSON and maps failures onto Temporal's retry semantics, so the retry policy lives in the
 * workflow and providers only describe *what* went wrong.
 */
export async function postJson(
  providerId: PhoneProviderId,
  { url, body, headers, timeoutMs }: PostJsonRequest,
  fetchFn: FetchFn = fetch
): Promise<unknown> {
  let res: Response
  try {
    res = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw ApplicationFailure.retryable(
      `${providerId}: request failed (${reason})`,
      PHONE_PROVIDER_ERROR_TYPES.UNAVAILABLE
    )
  }

  if (res.status === 429) {
    throw ApplicationFailure.create({
      message: `${providerId}: rate limited`,
      type: PHONE_PROVIDER_ERROR_TYPES.RATE_LIMITED,
      nextRetryDelay: parseRetryAfterMs(res.headers.get('retry-after')),
    })
  }

  if (res.status >= 500) {
    throw ApplicationFailure.retryable(
      `${providerId}: HTTP ${res.status}`,
      PHONE_PROVIDER_ERROR_TYPES.UNAVAILABLE
    )
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200)
    throw ApplicationFailure.nonRetryable(
      `${providerId}: HTTP ${res.status} ${detail}`.trim(),
      PHONE_PROVIDER_ERROR_TYPES.REJECTED
    )
  }

  try {
    return await res.json()
  } catch {
    throw ApplicationFailure.retryable(
      `${providerId}: invalid JSON response`,
      PHONE_PROVIDER_ERROR_TYPES.UNAVAILABLE
    )
  }
}

/** Retry-After is either delta-seconds or an HTTP date. Undefined falls back to the retry policy's backoff. */
export function parseRetryAfterMs(header: string | null, now: number = Date.now()): number | undefined {
  if (!header) return undefined
  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000
  const date = Date.parse(header)
  if (Number.isNaN(date)) return undefined
  return Math.max(0, date - now)
}

/** Providers disagree on types (string vs number) and on "nothing" (null, undefined, ""). */
export function normalizePhone(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && value.trim()) return value.trim()
  return null
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

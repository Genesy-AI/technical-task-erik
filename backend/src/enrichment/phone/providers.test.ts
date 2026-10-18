import { describe, it, expect, vi } from 'vitest'
import { ApplicationFailure } from '@temporalio/common'
import { createPhoneProviders, lookupWithProvider } from './providers'
import { normalizePhone, parseRetryAfterMs } from './http'
import { PHONE_PROVIDER_ERROR_TYPES } from './constants'
import { PhoneLookupInput, PhoneProvidersConfig } from './types'

const config: PhoneProvidersConfig = {
  orionConnect: { baseUrl: 'https://orion.test/lookup', apiKey: 'orion-key' },
  astraDialer: { baseUrl: 'https://astra.test/lookup', apiKey: 'astra-key' },
  nimbusLookup: { baseUrl: 'https://nimbus.test/lookup', apiKey: 'nimbus-key' },
}

const input: PhoneLookupInput = {
  fullName: 'Ada Lovelace',
  email: 'ada@acme.com',
  jobTitle: 'CTO',
  companyWebsite: 'acme.com',
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers })
}

function setup(response: Response | (() => Promise<Response>)) {
  const fetchFn = vi.fn(typeof response === 'function' ? response : async () => response)
  return { fetchFn, providers: createPhoneProviders(config, fetchFn as unknown as typeof fetch) }
}

async function expectFailure(promise: Promise<unknown>, type: string, nonRetryable: boolean) {
  const error = (await promise.catch((e) => e)) as ApplicationFailure
  expect(error).toBeInstanceOf(ApplicationFailure)
  expect(error.type).toBe(type)
  expect(error.nonRetryable).toBe(nonRetryable)
  return error
}

describe('provider request mapping', () => {
  it('orionConnect sends fullName + companyWebsite with x-auth-me header', async () => {
    const { fetchFn, providers } = setup(jsonResponse(200, { phone: '+34 600 000 000' }))
    await expect(providers.orionConnect.lookup(input)).resolves.toBe('+34 600 000 000')

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://orion.test/lookup')
    expect(JSON.parse(init.body as string)).toEqual({ fullName: 'Ada Lovelace', companyWebsite: 'acme.com' })
    expect(init.headers).toMatchObject({ 'x-auth-me': 'orion-key' })
  })

  it('astraDialer sends email with apiKey header and reads phoneNmbr', async () => {
    const { fetchFn, providers } = setup(jsonResponse(200, { phoneNmbr: '6336840604' }))
    await expect(providers.astraDialer.lookup(input)).resolves.toBe('6336840604')

    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({ email: 'ada@acme.com' })
    expect(init.headers).toMatchObject({ apiKey: 'astra-key' })
  })

  it('nimbusLookup authenticates via query param and accepts numeric phoneNmbr', async () => {
    const { fetchFn, providers } = setup(jsonResponse(200, { phoneNmbr: 3789139462, countryCode: 'ES' }))
    await expect(providers.nimbusLookup.lookup(input)).resolves.toBe('3789139462')

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://nimbus.test/lookup?api=nimbus-key')
    expect(JSON.parse(init.body as string)).toEqual({ email: 'ada@acme.com', jobTitle: 'CTO' })
  })

  it('nimbusLookup also accepts the documented `number` field', async () => {
    const { providers } = setup(jsonResponse(200, { number: 600111222, countryCode: 'ES' }))
    await expect(providers.nimbusLookup.lookup(input)).resolves.toBe('600111222')
  })
})

describe('no data', () => {
  it.each([{ phoneNmbr: null }, {}, { phoneNmbr: '' }])('astraDialer returns null for %j', async (body) => {
    const { providers } = setup(jsonResponse(200, body))
    await expect(providers.astraDialer.lookup(input)).resolves.toBeNull()
  })
})

describe('error classification', () => {
  it('5xx is retryable', async () => {
    const { providers } = setup(jsonResponse(500, { message: 'Internal server error' }))
    await expectFailure(providers.orionConnect.lookup(input), PHONE_PROVIDER_ERROR_TYPES.UNAVAILABLE, false)
  })

  it('network errors are retryable', async () => {
    const { providers } = setup(() => Promise.reject(new TypeError('fetch failed')))
    await expectFailure(providers.astraDialer.lookup(input), PHONE_PROVIDER_ERROR_TYPES.UNAVAILABLE, false)
  })

  it('401 / 400 are not retryable', async () => {
    const { providers } = setup(jsonResponse(401, 'Unauthorized'))
    await expectFailure(providers.nimbusLookup.lookup(input), PHONE_PROVIDER_ERROR_TYPES.REJECTED, true)
  })

  it('429 is retryable and honours Retry-After', async () => {
    const { providers } = setup(jsonResponse(429, {}, { 'retry-after': '7' }))
    const error = await expectFailure(
      providers.astraDialer.lookup(input),
      PHONE_PROVIDER_ERROR_TYPES.RATE_LIMITED,
      false
    )
    expect(error.nextRetryDelay).toBe(7000)
  })

  it('unparsable 200 body is retryable', async () => {
    const { providers } = setup(jsonResponse(200, '<html>'))
    await expectFailure(providers.astraDialer.lookup(input), PHONE_PROVIDER_ERROR_TYPES.UNAVAILABLE, false)
  })
})

describe('lookupWithProvider', () => {
  it('skips without calling the provider when required inputs are missing', async () => {
    const { fetchFn, providers } = setup(jsonResponse(200, { phone: '1' }))
    await expect(
      lookupWithProvider(providers.orionConnect, { ...input, companyWebsite: null })
    ).resolves.toEqual({ status: 'skipped', reason: 'missing companyWebsite' })
    await expect(lookupWithProvider(providers.nimbusLookup, { ...input, jobTitle: '  ' })).resolves.toEqual({
      status: 'skipped',
      reason: 'missing jobTitle',
    })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('maps phone / null to found / no_data', async () => {
    await expect(
      lookupWithProvider(setup(jsonResponse(200, { phone: '123' })).providers.orionConnect, input)
    ).resolves.toEqual({ status: 'found', phone: '123' })
    await expect(
      lookupWithProvider(setup(jsonResponse(200, { phone: null })).providers.orionConnect, input)
    ).resolves.toEqual({ status: 'no_data' })
  })
})

describe('helpers', () => {
  it('normalizePhone', () => {
    expect(normalizePhone(' 123 ')).toBe('123')
    expect(normalizePhone(42)).toBe('42')
    expect(normalizePhone(NaN)).toBeNull()
    expect(normalizePhone(undefined)).toBeNull()
    expect(normalizePhone({})).toBeNull()
  })

  it('parseRetryAfterMs handles seconds, dates and garbage', () => {
    const now = Date.parse('2026-01-01T00:00:00Z')
    expect(parseRetryAfterMs('3', now)).toBe(3000)
    expect(parseRetryAfterMs('Thu, 01 Jan 2026 00:00:10 GMT', now)).toBe(10_000)
    expect(parseRetryAfterMs('soon', now)).toBeUndefined()
    expect(parseRetryAfterMs(null, now)).toBeUndefined()
  })
})

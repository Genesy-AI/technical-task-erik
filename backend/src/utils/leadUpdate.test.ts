import { describe, expect, it } from 'vitest'
import { parseLeadUpdate } from './leadUpdate'

describe('parseLeadUpdate', () => {
  it('only includes the fields that were sent', () => {
    expect(parseLeadUpdate({ email: ' ada@acme.com ' })).toEqual({ data: { email: 'ada@acme.com' } })
    expect(parseLeadUpdate({ firstName: 'Ada' })).toEqual({ data: { firstName: 'Ada' } })
  })

  it('accepts `name` as an alias of firstName', () => {
    expect(parseLeadUpdate({ name: 'Ada', email: 'ada@acme.com' })).toEqual({
      data: { firstName: 'Ada', email: 'ada@acme.com' },
    })
  })

  it.each([
    [null, 'Request body is required and must be a JSON object'],
    [[], 'Request body is required and must be a JSON object'],
    [{}, 'Provide at least one of firstName or email'],
    [{ phoneNumber: null }, 'Provide at least one of firstName or email'],
    [{ firstName: '  ' }, 'firstName must be a non-empty string'],
    [{ email: 42 }, 'email must be a non-empty string'],
  ])('rejects %j', (body, error) => {
    expect(parseLeadUpdate(body)).toEqual({ error })
  })
})

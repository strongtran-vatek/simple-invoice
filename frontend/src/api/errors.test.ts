import { AxiosError, type AxiosResponse } from 'axios'
import { getErrorMessages, getErrorStatus } from './errors'

function responseError(status: number, data: unknown): AxiosError {
  const response = { status, data } as AxiosResponse
  return new AxiosError('Request failed', 'ERR', undefined, undefined, response)
}

describe('getErrorMessages', () => {
  it('returns a single server message as a list of one', () => {
    const error = responseError(404, { message: 'Invoice not found' })

    expect(getErrorMessages(error)).toEqual(['Invoice not found'])
  })

  it('returns a list of validation messages unchanged', () => {
    const error = responseError(400, { message: ['a', 'b'] })

    expect(getErrorMessages(error)).toEqual(['a', 'b'])
  })

  it('explains a request that got no response', () => {
    const error = new AxiosError('Network Error', 'ERR_NETWORK')

    expect(getErrorMessages(error)[0]).toMatch(/Cannot reach the server/)
  })

  it('falls back to a generic message for a body without one', () => {
    expect(getErrorMessages(responseError(500, '<html>'))).toEqual([
      'Something went wrong. Please try again.',
    ])
  })

  it('falls back to a generic message for a non-HTTP error', () => {
    expect(getErrorMessages(new Error('boom'))).toEqual([
      'Something went wrong. Please try again.',
    ])
  })
})

describe('getErrorStatus', () => {
  it('returns the response status', () => {
    expect(getErrorStatus(responseError(409, {}))).toBe(409)
  })

  it('returns undefined when there was no response', () => {
    expect(getErrorStatus(new Error('boom'))).toBeUndefined()
  })
})

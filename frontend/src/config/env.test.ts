import { readApiUrl } from './env'

describe('readApiUrl', () => {
  it('returns the configured URL', () => {
    expect(readApiUrl({ VITE_API_URL: 'http://localhost:3000' })).toBe(
      'http://localhost:3000',
    )
  })

  it('removes trailing slashes', () => {
    expect(readApiUrl({ VITE_API_URL: 'http://localhost:3000//' })).toBe(
      'http://localhost:3000',
    )
  })

  it('throws a helpful error when the URL is missing', () => {
    expect(() => readApiUrl({})).toThrow(/VITE_API_URL is not set/)
  })

  it('throws when the URL is blank', () => {
    expect(() => readApiUrl({ VITE_API_URL: '  ' })).toThrow(/VITE_API_URL/)
  })

  it('reads the build-time environment by default', () => {
    expect(readApiUrl()).toBe('http://api.test')
  })
})

const STORAGE_KEY = 'simpleinvoice.accessToken'

/**
 * Where the access token lives between page loads.
 * It is kept in localStorage; docs/adr/0004 records the trade-off.
 */
export const tokenStorage = {
  get(): string | null {
    return localStorage.getItem(STORAGE_KEY)
  },
  set(token: string): void {
    localStorage.setItem(STORAGE_KEY, token)
  },
  clear(): void {
    localStorage.removeItem(STORAGE_KEY)
  },
}

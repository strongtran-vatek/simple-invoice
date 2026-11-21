import axios, { isAxiosError } from 'axios'
import { tokenStorage } from '../auth/tokenStorage'
import { readApiUrl } from '../config/env'

export const LOGIN_PATH = '/auth/login'

/** The one HTTP client for the backend. It attaches the access token to every request. */
export const http = axios.create({
  baseURL: readApiUrl(),
  // Use the browser's fetch rather than XMLHttpRequest.
  adapter: 'fetch',
})

http.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

type UnauthorizedListener = () => void
const unauthorizedListeners = new Set<UnauthorizedListener>()

/**
 * Subscribes to "the session is no longer valid" (a 401 on any call except
 * login itself). Returns a function that unsubscribes.
 */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
}

http.interceptors.response.use(undefined, (error: unknown) => {
  const sessionRejected =
    isAxiosError(error) &&
    error.response?.status === 401 &&
    // A 401 from login means wrong credentials, not an expired session.
    error.config?.url !== LOGIN_PATH

  if (sessionRejected) {
    tokenStorage.clear()
    unauthorizedListeners.forEach((listener) => listener())
  }
  return Promise.reject(error)
})

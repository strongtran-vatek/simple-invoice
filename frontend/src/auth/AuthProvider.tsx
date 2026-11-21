import { useQueryClient } from '@tanstack/react-query'
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { type Credentials, fetchCurrentUser, login } from '../api/auth'
import { onUnauthorized } from '../api/http'
import { AuthContext, type AuthState } from './AuthContext'
import { tokenStorage } from './tokenStorage'

/**
 * Owns the session: restores it from a stored token on load, signs in and out,
 * and signs out when the backend rejects the token.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>(() =>
    tokenStorage.get() ? { status: 'loading' } : { status: 'signedOut' },
  )

  // On load, a stored token is only trusted once the backend confirms it.
  useEffect(() => {
    if (!tokenStorage.get()) {
      return
    }
    let cancelled = false
    fetchCurrentUser()
      .then((user) => {
        if (!cancelled) setState({ status: 'signedIn', user })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'signedOut' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Any 401 means the token expired or was revoked: drop everything it fetched.
  useEffect(
    () =>
      onUnauthorized(() => {
        queryClient.clear()
        setState({ status: 'signedOut' })
      }),
    [queryClient],
  )

  const signIn = useCallback(async (credentials: Credentials) => {
    const { accessToken } = await login(credentials)
    tokenStorage.set(accessToken)
    try {
      const user = await fetchCurrentUser()
      setState({ status: 'signedIn', user })
    } catch (error) {
      tokenStorage.clear()
      throw error
    }
  }, [])

  const signOut = useCallback(() => {
    tokenStorage.clear()
    queryClient.clear()
    setState({ status: 'signedOut' })
  }, [queryClient])

  const value = useMemo(
    () => ({ ...state, signIn, signOut }),
    [state, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

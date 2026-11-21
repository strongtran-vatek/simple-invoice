import { createContext, useContext } from 'react'
import type { Credentials, UserProfile } from '../api/auth'

export type AuthState =
  /** A stored token is being checked with the backend. */
  | { status: 'loading' }
  | { status: 'signedIn'; user: UserProfile }
  | { status: 'signedOut' }

export type AuthContextValue = AuthState & {
  /** Rejects with the request error when the credentials are refused. */
  signIn(credentials: Credentials): Promise<void>
  signOut(): void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return value
}

import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './AuthContext'

/** Router state carried to the Login screen so it can return the user afterwards. */
export interface LoginRedirectState {
  from: string
}

/**
 * Renders the nested routes only for a signed-in user. Anyone else is sent to
 * the Login screen, which returns them to the page they asked for.
 */
export function RequireAuth() {
  const auth = useAuth()
  const { status } = auth
  const location = useLocation()

  if (status === 'loading') {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <CircularProgress aria-label="Checking your session" />
      </Box>
    )
  }

  if (auth.status === 'signedOut') {
    // Someone who followed a link, or whose session expired, is returned to
    // this page after signing in. Someone who logged out on purpose is not:
    // their next sign-in opens the Invoice List, the home screen.
    const state: LoginRedirectState | undefined = auth.loggedOut
      ? undefined
      : { from: location.pathname + location.search }
    return <Navigate to="/login" replace state={state} />
  }

  return <Outlet />
}

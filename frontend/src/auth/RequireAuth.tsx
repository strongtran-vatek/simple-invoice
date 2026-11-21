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
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <CircularProgress aria-label="Checking your session" />
      </Box>
    )
  }

  if (status === 'signedOut') {
    const state: LoginRedirectState = {
      from: location.pathname + location.search,
    }
    return <Navigate to="/login" replace state={state} />
  }

  return <Outlet />
}

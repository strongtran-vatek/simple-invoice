import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { Link, Outlet } from 'react-router'
import { useAuth } from '../auth/AuthContext'

/** The frame around every signed-in page: title, who is signed in, and Logout. */
export function AppLayout() {
  const auth = useAuth()

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar position="sticky">
        <Toolbar sx={{ gap: 2 }}>
          <Typography
            variant="h6"
            component={Link}
            to="/invoices"
            sx={{ flexGrow: 1, color: 'inherit', textDecoration: 'none' }}
          >
            SimpleInvoice
          </Typography>
          {auth.status === 'signedIn' && (
            <Typography
              variant="body2"
              noWrap
              // The name gives way to the Logout button on narrow screens.
              sx={{ display: { xs: 'none', sm: 'block' } }}
            >
              {auth.user.fullname}
            </Typography>
          )}
          <Button color="inherit" variant="outlined" onClick={auth.signOut}>
            Log out
          </Button>
        </Toolbar>
      </AppBar>
      <Box component="main">
        <Outlet />
      </Box>
    </Box>
  )
}

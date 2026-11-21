import CloseIcon from '@mui/icons-material/Close'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Snackbar from '@mui/material/Snackbar'
import { type ReactNode, useCallback, useState } from 'react'
import { Link } from 'react-router'
import { type Notification, NotificationContext } from './NotificationContext'

const VISIBLE_FOR_MS = 6000

/**
 * Shows success messages in a snackbar. It must sit inside the router, since
 * a message may carry a link.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<Notification | null>(null)
  const [open, setOpen] = useState(false)

  const notify = useCallback((next: Notification) => {
    setNotification(next)
    setOpen(true)
  }, [])
  const close = () => setOpen(false)

  return (
    <NotificationContext.Provider value={notify}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={VISIBLE_FOR_MS}
        // Clicking elsewhere on the page should not dismiss the message.
        onClose={(_event, reason) => reason !== 'clickaway' && close()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          variant="filled"
          // Announced politely: it confirms an action, it is not an error.
          role="status"
          action={
            <>
              {notification?.action && (
                <Button
                  component={Link}
                  to={notification.action.to}
                  color="inherit"
                  size="small"
                  onClick={close}
                >
                  {notification.action.label}
                </Button>
              )}
              <IconButton
                aria-label="Dismiss"
                color="inherit"
                size="small"
                onClick={close}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </>
          }
          sx={{ width: '100%' }}
        >
          {notification?.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  )
}

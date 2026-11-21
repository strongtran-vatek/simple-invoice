import { zodResolver } from '@hookform/resolvers/zod'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation } from 'react-router'
import { z } from 'zod'
import { getErrorMessages } from '../api/errors'
import { useAuth } from '../auth/AuthContext'
import type { LoginRedirectState } from '../auth/RequireAuth'

// Mirrors the backend's LoginDto: a valid email and a non-empty password.
const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const auth = useAuth()
  const location = useLocation()
  const [submitErrors, setSubmitErrors] = useState<string[]>([])
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  if (auth.status === 'signedIn') {
    const from = (location.state as LoginRedirectState | null)?.from
    return <Navigate to={from ?? '/invoices'} replace />
  }

  const onSubmit = handleSubmit(async (credentials) => {
    setSubmitErrors([])
    try {
      await auth.signIn(credentials)
    } catch (error) {
      setSubmitErrors(getErrorMessages(error))
    }
  })

  return (
    <Container
      maxWidth="xs"
      sx={{ minHeight: '100vh', display: 'grid', alignItems: 'center', py: 4 }}
    >
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
        <Typography variant="h5" component="h1" gutterBottom>
          Sign in to SimpleInvoice
        </Typography>

        <Box component="form" noValidate onSubmit={onSubmit}>
          <Stack spacing={2} sx={{ mt: 2 }}>
            {submitErrors.length > 0 && (
              <Alert severity="error">
                {submitErrors.map((message) => (
                  <div key={message}>{message}</div>
                ))}
              </Alert>
            )}
            <TextField
              label="Email address"
              type="email"
              autoComplete="email"
              autoFocus
              fullWidth
              error={Boolean(errors.email)}
              helperText={errors.email?.message}
              {...register('email')}
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              fullWidth
              error={Boolean(errors.password)}
              helperText={errors.password?.message}
              {...register('password')}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Container>
  )
}

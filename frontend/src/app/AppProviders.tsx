import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { AuthProvider } from '../auth/AuthProvider'
import { theme } from './theme'

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // A failed request is shown to the user with a Retry button rather than retried silently.
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  })
}

/** Theme, server-state and session providers shared by the app and its tests. */
export function AppProviders({ children }: { children: ReactNode }) {
  // One client per mounted tree, so tests never share a cache.
  const [queryClient] = useState(createQueryClient)

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

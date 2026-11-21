/**
 * Reads the backend's base URL from the build-time environment.
 * Fails loudly instead of letting every request go to "undefined/...".
 */
export function readApiUrl(
  env: Record<string, unknown> = import.meta.env,
): string {
  const value = env.VITE_API_URL

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      'VITE_API_URL is not set. Copy .env.example to .env at the repository root.',
    )
  }

  // No trailing slash, so callers can always write `${apiUrl}/invoices`.
  return value.trim().replace(/\/+$/, '')
}

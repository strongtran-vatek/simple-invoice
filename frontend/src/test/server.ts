import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

/** Matches VITE_API_URL in vite.config.ts. */
export const API_URL = 'http://api.test'

export const TEST_USER = {
  id: '0b9d7f0e-6f1a-4c53-9b0a-2f6f1c1d2e3f',
  email: 'reviewer@example.com',
  fullname: 'Test Reviewer',
}
export const TEST_PASSWORD = 'correct-horse-battery'
export const TEST_TOKEN = 'header.payload.signature'

const unauthorized = (message: string) =>
  HttpResponse.json(
    { statusCode: 401, message, error: 'Unauthorized' },
    { status: 401 },
  )

/**
 * A fake backend that behaves like the real one for authentication: one known
 * user, one valid token. Tests override single handlers with `server.use(...)`.
 */
export const server = setupServer(
  http.post(`${API_URL}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string }
    if (body.email === TEST_USER.email && body.password === TEST_PASSWORD) {
      return HttpResponse.json({
        accessToken: TEST_TOKEN,
        tokenType: 'Bearer',
        expiresIn: 3600,
      })
    }
    return unauthorized('Invalid email or password')
  }),

  http.get(`${API_URL}/auth/me`, ({ request }) => {
    const authorization = request.headers.get('Authorization')
    if (!authorization) {
      return unauthorized('Authentication required')
    }
    if (authorization !== `Bearer ${TEST_TOKEN}`) {
      return unauthorized('Invalid or expired token')
    }
    return HttpResponse.json(TEST_USER)
  }),
)

import { screen } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { tokenStorage } from '../auth/tokenStorage'
import { renderApp } from '../test/renderApp'
import { API_URL, server, TEST_PASSWORD, TEST_USER } from '../test/server'

const emailField = () => screen.getByLabelText('Email address')
const passwordField = () => screen.getByLabelText('Password')
const submit = () => screen.getByRole('button', { name: 'Sign in' })

/** Fails the test if the form reaches the backend. */
function forbidLoginRequests() {
  const calls: unknown[] = []
  server.use(
    http.post(`${API_URL}/auth/login`, async ({ request }) => {
      calls.push(await request.json())
      return HttpResponse.json({}, { status: 500 })
    }),
  )
  return calls
}

describe('LoginPage', () => {
  it('has email and password fields', async () => {
    renderApp('/login')

    expect(emailField()).toHaveAttribute('type', 'email')
    expect(passwordField()).toHaveAttribute('type', 'password')
  })

  describe('client-side validation', () => {
    it('requires both fields and sends nothing', async () => {
      const calls = forbidLoginRequests()
      const { user } = renderApp('/login')

      await user.click(submit())

      expect(await screen.findByText('Email is required')).toBeInTheDocument()
      expect(screen.getByText('Password is required')).toBeInTheDocument()
      expect(calls).toEqual([])
    })

    it('rejects a malformed email and sends nothing', async () => {
      const calls = forbidLoginRequests()
      const { user } = renderApp('/login')

      await user.type(emailField(), 'not-an-email')
      await user.type(passwordField(), TEST_PASSWORD)
      await user.click(submit())

      expect(
        await screen.findByText('Enter a valid email address'),
      ).toBeInTheDocument()
      expect(calls).toEqual([])
    })
  })

  describe('when the backend refuses the sign-in', () => {
    it('shows the reason for wrong credentials and stays on the page', async () => {
      const { user } = renderApp('/login')

      await user.type(emailField(), TEST_USER.email)
      await user.type(passwordField(), 'wrong-password')
      await user.click(submit())

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Invalid email or password',
      )
      expect(tokenStorage.get()).toBeNull()
      expect(submit()).toBeEnabled()
    })

    it('shows the rate-limit message', async () => {
      server.use(
        http.post(`${API_URL}/auth/login`, () =>
          HttpResponse.json(
            {
              statusCode: 429,
              message: 'Too many login attempts. Try again in a minute.',
              error: 'Too Many Requests',
            },
            { status: 429 },
          ),
        ),
      )
      const { user } = renderApp('/login')

      await user.type(emailField(), TEST_USER.email)
      await user.type(passwordField(), TEST_PASSWORD)
      await user.click(submit())

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Too many login attempts. Try again in a minute.',
      )
    })

    it('shows every server-side validation message', async () => {
      server.use(
        http.post(`${API_URL}/auth/login`, () =>
          HttpResponse.json(
            {
              statusCode: 400,
              message: ['first problem', 'second problem'],
              error: 'Bad Request',
            },
            { status: 400 },
          ),
        ),
      )
      const { user } = renderApp('/login')

      await user.type(emailField(), TEST_USER.email)
      await user.type(passwordField(), TEST_PASSWORD)
      await user.click(submit())

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('first problem')
      expect(alert).toHaveTextContent('second problem')
    })

    it('says so when the server cannot be reached', async () => {
      server.use(http.post(`${API_URL}/auth/login`, () => HttpResponse.error()))
      const { user } = renderApp('/login')

      await user.type(emailField(), TEST_USER.email)
      await user.type(passwordField(), TEST_PASSWORD)
      await user.click(submit())

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Cannot reach the server',
      )
    })
  })

  it('disables the button while the request is in flight', async () => {
    server.use(
      http.post(`${API_URL}/auth/login`, async () => {
        await delay(50)
        return HttpResponse.json(
          { statusCode: 401, message: 'Invalid email or password' },
          { status: 401 },
        )
      }),
    )
    const { user } = renderApp('/login')

    await user.type(emailField(), TEST_USER.email)
    await user.type(passwordField(), TEST_PASSWORD)
    await user.click(submit())

    expect(
      await screen.findByRole('button', { name: 'Signing in…' }),
    ).toBeDisabled()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('trims the email before sending it', async () => {
    let sent: { email?: string } = {}
    server.use(
      http.post(`${API_URL}/auth/login`, async ({ request }) => {
        sent = (await request.json()) as { email: string }
        return HttpResponse.json(
          { statusCode: 401, message: 'Invalid email or password' },
          { status: 401 },
        )
      }),
    )
    const { user } = renderApp('/login')

    await user.type(emailField(), `  ${TEST_USER.email}  `)
    await user.type(passwordField(), TEST_PASSWORD)
    await user.click(submit())

    await screen.findByRole('alert')
    expect(sent.email).toBe(TEST_USER.email)
  })
})

import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { tokenStorage } from '../auth/tokenStorage'
import { currentUrl, renderApp } from '../test/renderApp'
import {
  API_URL,
  server,
  TEST_INVOICES,
  TEST_PASSWORD,
  TEST_TOKEN,
  TEST_USER,
} from '../test/server'

type User = ReturnType<typeof renderApp>['user']

async function signIn(user: User) {
  await user.type(screen.getByLabelText('Email address'), TEST_USER.email)
  await user.type(screen.getByLabelText('Password'), TEST_PASSWORD)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

const loginHeading = () =>
  screen.findByRole('heading', { name: 'Sign in to SimpleInvoice' })
const invoicesHeading = () => screen.findByRole('heading', { name: 'Invoices' })

describe('route protection', () => {
  it('sends an unauthenticated visitor to the Login screen', async () => {
    renderApp('/invoices')

    expect(await loginHeading()).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Invoices' }),
    ).not.toBeInTheDocument()
  })

  it('protects unknown paths too', async () => {
    renderApp('/no-such-page')

    expect(await loginHeading()).toBeInTheDocument()
  })

  it('makes the Invoice List the home screen after sign-in', async () => {
    const { user } = renderApp('/')

    await signIn(user)

    expect(await invoicesHeading()).toBeInTheDocument()
    expect(tokenStorage.get()).toBe(TEST_TOKEN)
  })

  it('returns the user to the page they first asked for', async () => {
    const { user } = renderApp('/no-such-page')

    await signIn(user)

    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument()
  })
})

describe('restoring a session', () => {
  it('keeps a user with a valid stored token signed in', async () => {
    tokenStorage.set(TEST_TOKEN)

    renderApp('/invoices')

    expect(await invoicesHeading()).toBeInTheDocument()
    expect(screen.getByText(TEST_USER.fullname)).toBeInTheDocument()
  })

  it('shows a progress indicator, not the page, while the token is checked', () => {
    tokenStorage.set(TEST_TOKEN)

    renderApp('/invoices')

    expect(screen.getByLabelText('Checking your session')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Invoices' }),
    ).not.toBeInTheDocument()
  })

  it('signs out and forgets a token the backend rejects', async () => {
    tokenStorage.set('expired.token.value')

    renderApp('/invoices')

    expect(await loginHeading()).toBeInTheDocument()
    expect(tokenStorage.get()).toBeNull()
  })

  it('sends the token as a Bearer header', async () => {
    let authorization: string | null = null
    server.use(
      http.get(`${API_URL}/auth/me`, ({ request }) => {
        authorization = request.headers.get('Authorization')
        return HttpResponse.json(TEST_USER)
      }),
    )
    tokenStorage.set(TEST_TOKEN)

    renderApp('/invoices')

    await invoicesHeading()
    expect(authorization).toBe(`Bearer ${TEST_TOKEN}`)
  })
})

describe('signing out', () => {
  it('forgets the token and returns to the Login screen', async () => {
    tokenStorage.set(TEST_TOKEN)
    const { user } = renderApp('/invoices')
    await invoicesHeading()

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await loginHeading()).toBeInTheDocument()
    expect(tokenStorage.get()).toBeNull()
  })

  it('opens the Invoice List, not the page that was left, on the next sign-in', async () => {
    tokenStorage.set(TEST_TOKEN)
    const { user } = renderApp(`/invoices/${TEST_INVOICES[0].invoiceId}`)
    await screen.findByRole('heading', { name: 'Invoice INV-0001' })

    await user.click(screen.getByRole('button', { name: 'Log out' }))
    await loginHeading()
    await signIn(user)

    expect(await invoicesHeading()).toBeInTheDocument()
    expect(currentUrl()).toBe('/invoices')
  })

  it('still returns to the page in use when the session expired by itself', async () => {
    tokenStorage.set(TEST_TOKEN)
    const invoice = TEST_INVOICES[0]
    // The token is accepted on load, then rejected when the invoice is fetched.
    server.use(
      http.get(
        `${API_URL}/invoices/:invoiceId`,
        () =>
          HttpResponse.json(
            {
              statusCode: 401,
              message: 'Invalid or expired token',
              error: 'Unauthorized',
            },
            { status: 401 },
          ),
        { once: true },
      ),
    )
    const { user } = renderApp(`/invoices/${invoice.invoiceId}`)

    await loginHeading()
    await signIn(user)

    expect(
      await screen.findByRole('heading', { name: 'Invoice INV-0001' }),
    ).toBeInTheDocument()
  })

  it('redirects a signed-in user away from the Login screen', async () => {
    tokenStorage.set(TEST_TOKEN)

    renderApp('/login')

    expect(await invoicesHeading()).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Sign in to SimpleInvoice' }),
      ).not.toBeInTheDocument(),
    )
  })
})

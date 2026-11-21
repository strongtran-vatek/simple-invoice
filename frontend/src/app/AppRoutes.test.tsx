import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AppProviders } from './AppProviders'
import { AppRoutes } from './AppRoutes'

function renderAt(path: string) {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  )
}

describe('AppRoutes', () => {
  it('shows the home page at /', () => {
    renderAt('/')

    expect(
      screen.getByRole('heading', { name: 'SimpleInvoice' }),
    ).toBeInTheDocument()
  })

  it('shows a not-found page with a way back for an unknown path', () => {
    renderAt('/no-such-page')

    expect(
      screen.getByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Go to invoices' }),
    ).toHaveAttribute('href', '/')
  })
})

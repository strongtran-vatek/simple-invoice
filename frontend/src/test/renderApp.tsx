import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { AppProviders } from '../app/AppProviders'
import { AppRoutes } from '../app/AppRoutes'

/** Exposes the router's current URL to tests. */
function LocationProbe() {
  const location = useLocation()
  return (
    <output data-testid="location" hidden>
      {location.pathname + location.search}
    </output>
  )
}

/** The path and query string the app is currently at. */
export function currentUrl(): string {
  return screen.getByTestId('location').textContent ?? ''
}

/** Mounts the whole application at a path, as a browser would open it. */
export function renderApp(path = '/') {
  return {
    user: userEvent.setup(),
    ...render(
      <AppProviders>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
          <LocationProbe />
        </MemoryRouter>
      </AppProviders>,
    ),
  }
}

/**
 * Makes the page render as on a phone (or not). jsdom has no layout, so the
 * media query MUI asks about is answered here.
 */
export function setPhoneViewport(isPhone: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: isPhone && query.includes('max-width'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}

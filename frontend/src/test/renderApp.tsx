import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { AppProviders } from '../app/AppProviders'
import { AppRoutes } from '../app/AppRoutes'

/** Mounts the whole application at a path, as a browser would open it. */
export function renderApp(path = '/') {
  return {
    user: userEvent.setup(),
    ...render(
      <AppProviders>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AppProviders>,
    ),
  }
}

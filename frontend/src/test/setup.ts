import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { invoiceListRequests, server } from './server'

// A request no handler expects is a bug in the test or the app, so it fails loudly.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))

afterEach(() => {
  cleanup()
  server.resetHandlers()
  invoiceListRequests.length = 0
  localStorage.clear()
  vi.unstubAllGlobals()
})

afterAll(() => server.close())

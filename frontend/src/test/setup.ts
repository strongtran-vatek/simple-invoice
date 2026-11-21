import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { resetFakeBackend, server } from './server'

// A request no handler expects is a bug in the test or the app, so it fails loudly.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))

afterEach(() => {
  cleanup()
  server.resetHandlers()
  resetFakeBackend()
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

afterAll(() => server.close())

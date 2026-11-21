import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type { InvoiceStatus, InvoiceSummary } from '../api/invoices'

/** Matches VITE_API_URL in vite.config.ts. */
export const API_URL = 'http://api.test'

export const TEST_USER = {
  id: '0b9d7f0e-6f1a-4c53-9b0a-2f6f1c1d2e3f',
  email: 'reviewer@example.com',
  fullname: 'Test Reviewer',
}
export const TEST_PASSWORD = 'correct-horse-battery'
export const TEST_TOKEN = 'header.payload.signature'

const CUSTOMERS = ['Alice Johnson', 'Bob Stone', 'Carol White']
const STATUSES: InvoiceStatus[] = ['Draft', 'Pending', 'Paid', 'Overdue']

/**
 * 23 invoices, INV-0001 to INV-0023. Invoice n is dated the n-th of June 2026,
 * falls due the n-th of July and totals 100 × n, so the expected order under
 * any sort is easy to read off.
 */
export const TEST_INVOICES: InvoiceSummary[] = Array.from(
  { length: 23 },
  (_, index) => {
    const n = index + 1
    const day = String(n).padStart(2, '0')
    return {
      invoiceId: `00000000-0000-4000-8000-0000000000${day}`,
      invoiceNumber: `INV-00${day}`,
      invoiceDate: `2026-06-${day}`,
      dueDate: `2026-07-${day}`,
      currency: 'AUD',
      currencySymbol: 'AU$',
      totalAmount: n * 100,
      status: STATUSES[index % STATUSES.length],
      customer: { fullname: CUSTOMERS[index % CUSTOMERS.length] },
    }
  },
)

/** The query string of every `GET /invoices` the app has made in this test. */
export const invoiceListRequests: URLSearchParams[] = []

const unauthorized = (message: string) =>
  HttpResponse.json(
    { statusCode: 401, message, error: 'Unauthorized' },
    { status: 401 },
  )

/** Applies the same search, filter, sort and paging rules as the real backend. */
function listInvoices(query: URLSearchParams) {
  const keyword = query.get('keyword')?.toLowerCase()
  const status = query.get('status')
  const sortBy = (query.get('sortBy') ?? 'invoiceDate') as
    'invoiceDate' | 'dueDate' | 'totalAmount'
  const descending = (query.get('ordering') ?? 'DESC') === 'DESC'
  const page = Number(query.get('page') ?? 1)
  const pageSize = Number(query.get('pageSize') ?? 10)

  const matching = TEST_INVOICES.filter(
    (invoice) =>
      (!keyword ||
        invoice.invoiceNumber.toLowerCase().includes(keyword) ||
        invoice.customer.fullname.toLowerCase().includes(keyword)) &&
      (!status || invoice.status === status),
  ).sort((a, b) => {
    const order = a[sortBy] < b[sortBy] ? -1 : a[sortBy] > b[sortBy] ? 1 : 0
    return descending ? -order : order
  })

  return {
    data: matching.slice((page - 1) * pageSize, page * pageSize),
    paging: { page, pageSize, total: matching.length },
  }
}

/**
 * A fake backend that behaves like the real one: one known user, one valid
 * token, a fixed set of invoices. Tests override single handlers with `server.use(...)`.
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

  http.get(`${API_URL}/invoices`, ({ request }) => {
    if (request.headers.get('Authorization') !== `Bearer ${TEST_TOKEN}`) {
      return unauthorized('Authentication required')
    }
    const query = new URL(request.url).searchParams
    invoiceListRequests.push(query)
    return HttpResponse.json(listInvoices(query))
  }),
)

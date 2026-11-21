import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type {
  CreateInvoiceRequest,
  InvoiceDetail,
  InvoiceStatus,
  InvoiceSummary,
} from '../api/invoices'

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

/**
 * The full detail of a test invoice. Invoice n has one line of n units at 100
 * each, 10% tax and a discount equal to the tax, so its total is 100 × n.
 * Even-numbered invoices have every optional field; odd-numbered ones have none.
 */
export function detailOf(summary: InvoiceSummary): InvoiceDetail {
  const n = summary.totalAmount / 100
  const hasOptionalFields = n % 2 === 0
  const totalPaid =
    summary.status === 'Paid'
      ? summary.totalAmount
      : summary.status === 'Pending'
        ? summary.totalAmount / 4
        : 0

  return {
    ...summary,
    invoiceReference: hasOptionalFields ? `PO-${n}` : null,
    description: hasOptionalFields ? `Monthly service, batch ${n}` : null,
    taxRate: 10,
    invoiceSubTotal: summary.totalAmount,
    totalTax: summary.totalAmount / 10,
    totalDiscount: summary.totalAmount / 10,
    totalPaid,
    balanceAmount: summary.totalAmount - totalPaid,
    customer: {
      fullname: summary.customer.fullname,
      email: 'customer@example.com',
      mobileNumber: hasOptionalFields ? '0412345678' : null,
      address: hasOptionalFields ? '1 Harbour Street, Sydney' : null,
    },
    items: [
      {
        id: summary.invoiceId.replace(/^0/, '1'),
        name: 'Service package',
        quantity: n,
        rate: 100,
        amount: summary.totalAmount,
      },
    ],
    createdAt: `${summary.invoiceDate}T09:00:00.000Z`,
    createdBy: TEST_USER.id,
  }
}

/** The query string of every `GET /invoices` the app has made in this test. */
export const invoiceListRequests: URLSearchParams[] = []

/** The body of every `POST /invoices` the app has made in this test. */
export const invoiceCreateRequests: CreateInvoiceRequest[] = []

/** Invoices created during the current test, on top of `TEST_INVOICES`. */
const createdInvoices: InvoiceDetail[] = []

const allInvoices = (): InvoiceSummary[] => [
  ...TEST_INVOICES,
  ...createdInvoices.map(({ customer, ...invoice }) => ({
    ...invoice,
    customer: { fullname: customer.fullname },
  })),
]

/** Forgets what a test recorded and created. Run after every test. */
export function resetFakeBackend(): void {
  invoiceListRequests.length = 0
  invoiceCreateRequests.length = 0
  createdInvoices.length = 0
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  AUD: 'AU$',
  USD: 'US$',
  GBP: '£',
  EUR: '€',
  SGD: 'S$',
  VND: '₫',
}

const cents = (amount: number) => Math.round(amount * 100) / 100

/** Builds the invoice the real backend would store for a create request. */
function invoiceFrom(body: CreateInvoiceRequest): InvoiceDetail {
  const [item] = body.items
  const subTotal = cents(item.quantity * item.rate)
  const tax = cents((subTotal * body.tax) / 100)
  const total = cents(subTotal + tax - body.discount)
  const sequence = String(createdInvoices.length + 1).padStart(2, '0')

  return {
    invoiceId: `00000000-0000-4000-9000-0000000000${sequence}`,
    invoiceNumber: body.invoiceNumber,
    invoiceReference: body.invoiceReference ?? null,
    invoiceDate: body.invoiceDate,
    dueDate: body.dueDate,
    currency: body.currency,
    currencySymbol: CURRENCY_SYMBOLS[body.currency],
    description: body.description ?? null,
    status: 'Draft',
    taxRate: body.tax,
    invoiceSubTotal: subTotal,
    totalTax: tax,
    totalDiscount: body.discount,
    totalAmount: total,
    totalPaid: 0,
    balanceAmount: total,
    customer: {
      fullname: body.customer.fullname,
      email: body.customer.email,
      mobileNumber: body.customer.mobileNumber ?? null,
      address: body.customer.address ?? null,
    },
    items: [
      {
        id: `10000000-0000-4000-9000-0000000000${sequence}`,
        name: item.name,
        quantity: item.quantity,
        rate: item.rate,
        amount: subTotal,
      },
    ],
    createdAt: `${body.invoiceDate}T09:00:00.000Z`,
    createdBy: TEST_USER.id,
  }
}

const unauthorized = (message: string) =>
  HttpResponse.json(
    { statusCode: 401, message, error: 'Unauthorized' },
    { status: 401 },
  )

/** Applies the same search, filter, sort and paging rules as the real backend. */
function listInvoices(query: URLSearchParams) {
  const keyword = query.get('keyword')?.toLowerCase()
  const status = query.get('status')
  const fromDate = query.get('fromDate')
  const toDate = query.get('toDate')
  const sortBy = (query.get('sortBy') ?? 'invoiceDate') as
    'invoiceDate' | 'dueDate' | 'totalAmount'
  const descending = (query.get('ordering') ?? 'DESC') === 'DESC'
  const page = Number(query.get('page') ?? 1)
  const pageSize = Number(query.get('pageSize') ?? 10)

  const matching = allInvoices()
    .filter(
      (invoice) =>
        (!keyword ||
          invoice.invoiceNumber.toLowerCase().includes(keyword) ||
          invoice.customer.fullname.toLowerCase().includes(keyword)) &&
        (!status || invoice.status === status) &&
        (!fromDate || invoice.invoiceDate >= fromDate) &&
        (!toDate || invoice.invoiceDate <= toDate),
    )
    .sort((a, b) => {
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
 * token, a fixed set of invoices plus any the test creates. Tests override single handlers with `server.use(...)`.
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
    const fromDate = query.get('fromDate')
    const toDate = query.get('toDate')
    if (fromDate && toDate && toDate < fromDate) {
      return HttpResponse.json(
        {
          statusCode: 400,
          message: ['toDate must be on or after fromDate'],
          error: 'Bad Request',
        },
        { status: 400 },
      )
    }
    return HttpResponse.json(listInvoices(query))
  }),

  http.post(`${API_URL}/invoices`, async ({ request }) => {
    if (request.headers.get('Authorization') !== `Bearer ${TEST_TOKEN}`) {
      return unauthorized('Authentication required')
    }
    const body = (await request.json()) as CreateInvoiceRequest
    invoiceCreateRequests.push(body)

    const taken = allInvoices().some(
      (invoice) =>
        invoice.invoiceNumber.toLowerCase() ===
        body.invoiceNumber.toLowerCase(),
    )
    if (taken) {
      return HttpResponse.json(
        {
          statusCode: 409,
          message: 'An invoice with this invoice number already exists',
          error: 'Conflict',
        },
        { status: 409 },
      )
    }

    const invoice = invoiceFrom(body)
    createdInvoices.push(invoice)
    return HttpResponse.json(invoice, { status: 201 })
  }),

  http.get(`${API_URL}/invoices/:invoiceId`, ({ request, params }) => {
    if (request.headers.get('Authorization') !== `Bearer ${TEST_TOKEN}`) {
      return unauthorized('Authentication required')
    }
    const invoiceId = String(params.invoiceId)
    if (!/^[0-9a-f-]{36}$/.test(invoiceId)) {
      return HttpResponse.json(
        {
          statusCode: 400,
          message: 'id must be a valid UUID',
          error: 'Bad Request',
        },
        { status: 400 },
      )
    }
    const created = createdInvoices.find(
      (invoice) => invoice.invoiceId === invoiceId,
    )
    if (created) {
      return HttpResponse.json(created)
    }
    const summary = TEST_INVOICES.find(
      (invoice) => invoice.invoiceId === invoiceId,
    )
    if (!summary) {
      return HttpResponse.json(
        { statusCode: 404, message: 'Invoice not found', error: 'Not Found' },
        { status: 404 },
      )
    }
    return HttpResponse.json(detailOf(summary))
  }),
)

import { http } from './http'

export const INVOICE_STATUSES = ['Draft', 'Pending', 'Paid', 'Overdue'] as const
/** The effective status. Overdue is derived by the backend, never stored. */
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const SORT_FIELDS = ['invoiceDate', 'dueDate', 'totalAmount'] as const
export type SortField = (typeof SORT_FIELDS)[number]

export type SortOrder = 'ASC' | 'DESC'

/** One row of the invoice list. */
export interface InvoiceSummary {
  invoiceId: string
  invoiceNumber: string
  /** `YYYY-MM-DD` */
  invoiceDate: string
  /** `YYYY-MM-DD` */
  dueDate: string
  currency: string
  currencySymbol: string
  totalAmount: number
  status: InvoiceStatus
  customer: { fullname: string }
}

export interface InvoiceItem {
  id: string
  name: string
  quantity: number
  /** Price per unit. */
  rate: number
  /** quantity × rate, calculated by the backend. */
  amount: number
}

/** A complete invoice. Every field of a list row is here under the same name. */
export interface InvoiceDetail extends Omit<InvoiceSummary, 'customer'> {
  invoiceReference: string | null
  description: string | null
  /** Tax as a percentage, e.g. 10. */
  taxRate: number
  invoiceSubTotal: number
  totalTax: number
  /** An amount, not a percentage. */
  totalDiscount: number
  totalPaid: number
  balanceAmount: number
  customer: {
    fullname: string
    email: string
    mobileNumber: string | null
    address: string | null
  }
  items: InvoiceItem[]
  createdAt: string
  createdBy: string
}

export interface Paging {
  page: number
  pageSize: number
  /** Invoices matching the filters, across all pages. */
  total: number
}

export interface InvoiceListResponse {
  data: InvoiceSummary[]
  paging: Paging
}

export interface InvoiceListParams {
  page: number
  pageSize: number
  sortBy: SortField
  ordering: SortOrder
  status?: InvoiceStatus
  keyword?: string
  /** `YYYY-MM-DD`: only invoices dated on or after this day. */
  fromDate?: string
  /** `YYYY-MM-DD`: only invoices dated on or before this day. */
  toDate?: string
}

export async function fetchInvoices(
  params: InvoiceListParams,
): Promise<InvoiceListResponse> {
  // axios leaves out parameters whose value is undefined.
  const response = await http.get<InvoiceListResponse>('/invoices', { params })
  return response.data
}

export async function fetchInvoice(invoiceId: string): Promise<InvoiceDetail> {
  const response = await http.get<InvoiceDetail>(
    `/invoices/${encodeURIComponent(invoiceId)}`,
  )
  return response.data
}

/**
 * The body of `POST /invoices`. It carries no status and no totals: the
 * backend creates a Draft and calculates every amount.
 */
export interface CreateInvoiceRequest {
  invoiceNumber: string
  invoiceReference?: string
  /** `YYYY-MM-DD` */
  invoiceDate: string
  /** `YYYY-MM-DD`, on or after the invoice date. */
  dueDate: string
  currency: string
  description?: string
  customer: {
    fullname: string
    email: string
    mobileNumber?: string
    address?: string
  }
  /** Exactly one line item. */
  items: [{ name: string; quantity: number; rate: number }]
  /** Tax as a percentage. */
  tax: number
  /** An amount, not a percentage. */
  discount: number
}

export async function createInvoice(
  invoice: CreateInvoiceRequest,
): Promise<InvoiceDetail> {
  const response = await http.post<InvoiceDetail>('/invoices', invoice)
  return response.data
}

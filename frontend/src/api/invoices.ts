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
}

export async function fetchInvoices(
  params: InvoiceListParams,
): Promise<InvoiceListResponse> {
  // axios leaves out parameters whose value is undefined.
  const response = await http.get<InvoiceListResponse>('/invoices', { params })
  return response.data
}

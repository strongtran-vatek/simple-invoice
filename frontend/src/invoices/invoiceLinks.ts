import { useLocation } from 'react-router'

/** Router state carried from the list to a detail page, so "Back" can restore the list. */
export interface FromListState {
  /** The list's query string at the moment the invoice was opened, e.g. `?status=Paid`. */
  listSearch: string
}

export function invoicePath(invoiceId: string): string {
  return `/invoices/${invoiceId}`
}

/** The state to attach to links from the list to an invoice. */
export function useFromListState(): FromListState {
  return { listSearch: useLocation().search }
}

/** Where "Back to invoices" leads: the list as the user left it, or its default view. */
export function useBackToListPath(): string {
  const state = useLocation().state as Partial<FromListState> | null
  return `/invoices${state?.listSearch ?? ''}`
}

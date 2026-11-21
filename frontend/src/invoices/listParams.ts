import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import {
  INVOICE_STATUSES,
  type InvoiceListParams,
  type InvoiceStatus,
  SORT_FIELDS,
  type SortField,
} from '../api/invoices'

export const PAGE_SIZE_OPTIONS = [10, 25, 50]

export const DEFAULT_LIST_PARAMS: InvoiceListParams = {
  page: 1,
  pageSize: 10,
  sortBy: 'invoiceDate',
  ordering: 'DESC',
}

function positiveInteger(value: string | null): number | undefined {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

/**
 * Reads the list state from the URL's query string. Anything missing or
 * invalid falls back to its default, so a hand-edited URL never breaks the page.
 */
export function parseListParams(search: URLSearchParams): InvoiceListParams {
  const pageSize = positiveInteger(search.get('pageSize'))
  const sortBy = search.get('sortBy')
  const status = search.get('status')
  const keyword = search.get('keyword')?.trim()

  return {
    page: positiveInteger(search.get('page')) ?? DEFAULT_LIST_PARAMS.page,
    pageSize:
      pageSize !== undefined && PAGE_SIZE_OPTIONS.includes(pageSize)
        ? pageSize
        : DEFAULT_LIST_PARAMS.pageSize,
    sortBy: SORT_FIELDS.includes(sortBy as SortField)
      ? (sortBy as SortField)
      : DEFAULT_LIST_PARAMS.sortBy,
    ordering:
      search.get('ordering')?.toUpperCase() === 'ASC'
        ? 'ASC'
        : DEFAULT_LIST_PARAMS.ordering,
    status: INVOICE_STATUSES.includes(status as InvoiceStatus)
      ? (status as InvoiceStatus)
      : undefined,
    keyword: keyword || undefined,
  }
}

/** Writes the list state as a query string, leaving out values at their default. */
export function toSearchParams(params: InvoiceListParams): URLSearchParams {
  const search = new URLSearchParams()

  if (params.keyword) search.set('keyword', params.keyword)
  if (params.status) search.set('status', params.status)
  if (
    params.sortBy !== DEFAULT_LIST_PARAMS.sortBy ||
    params.ordering !== DEFAULT_LIST_PARAMS.ordering
  ) {
    search.set('sortBy', params.sortBy)
    search.set('ordering', params.ordering)
  }
  if (params.page !== DEFAULT_LIST_PARAMS.page) {
    search.set('page', String(params.page))
  }
  if (params.pageSize !== DEFAULT_LIST_PARAMS.pageSize) {
    search.set('pageSize', String(params.pageSize))
  }
  return search
}

/**
 * The invoice list's state, kept in the URL so it survives a reload, works
 * with the Back button and can be shared as a link.
 */
export function useInvoiceListParams() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useMemo(() => parseListParams(searchParams), [searchParams])

  const update = useCallback(
    (changes: Partial<InvoiceListParams>, options?: { replace?: boolean }) => {
      setSearchParams(
        (current) =>
          toSearchParams({ ...parseListParams(current), ...changes }),
        options,
      )
    },
    [setSearchParams],
  )

  return { params, update }
}

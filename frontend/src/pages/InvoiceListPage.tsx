import AddIcon from '@mui/icons-material/Add'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import { useTheme } from '@mui/material/styles'
import TablePagination from '@mui/material/TablePagination'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { Link } from 'react-router'
import { getErrorMessages } from '../api/errors'
import {
  fetchInvoices,
  INVOICE_STATUSES,
  type InvoiceStatus,
  type SortField,
  type SortOrder,
} from '../api/invoices'
import { InvoiceCards } from '../invoices/InvoiceCards'
import { NEW_INVOICE_PATH, useFromListState } from '../invoices/invoiceLinks'
import { InvoiceTable } from '../invoices/InvoiceTable'
import {
  isDateRangeInverted,
  PAGE_SIZE_OPTIONS,
  useInvoiceListParams,
} from '../invoices/listParams'
import { SearchField } from '../invoices/SearchField'

const ALL_STATUSES = 'All'
/** Keeps the browser's date picker to four-digit years. */
const MAX_DATE = '9999-12-31'

/** Sort choices for the phone layout, where there are no column headers to click. */
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'invoiceDate:DESC', label: 'Invoice date, newest first' },
  { value: 'invoiceDate:ASC', label: 'Invoice date, oldest first' },
  { value: 'dueDate:ASC', label: 'Due date, earliest first' },
  { value: 'dueDate:DESC', label: 'Due date, latest first' },
  { value: 'totalAmount:DESC', label: 'Total, highest first' },
  { value: 'totalAmount:ASC', label: 'Total, lowest first' },
]

/** The home screen: every invoice, with search, status filter, sorting and paging. */
export function InvoiceListPage() {
  const { params, update } = useInvoiceListParams()
  const isPhone = useMediaQuery(useTheme().breakpoints.down('sm'))
  const fromList = useFromListState()

  const rangeInverted = isDateRangeInverted(params)

  const { data, error, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ['invoices', params],
    queryFn: () => fetchInvoices(params),
    // Keep showing the current rows while the next page or filter loads.
    placeholderData: keepPreviousData,
    // The backend would refuse an inverted date range, so do not ask.
    enabled: !rangeInverted,
  })

  // Every change to what is listed returns to the first page.
  const search = useCallback(
    (keyword: string) =>
      update({ keyword: keyword || undefined, page: 1 }, { replace: true }),
    [update],
  )
  const filterByStatus = (value: string) =>
    update({
      status: value === ALL_STATUSES ? undefined : (value as InvoiceStatus),
      page: 1,
    })
  const sortBy = (field: SortField, ordering: SortOrder) =>
    update({ sortBy: field, ordering, page: 1 })
  const toggleSort = (field: SortField) =>
    sortBy(
      field,
      // A new column starts ascending; clicking the current one reverses it.
      params.sortBy === field && params.ordering === 'ASC' ? 'DESC' : 'ASC',
    )
  // Typing a date fires once per digit of the year, so these changes replace
  // the history entry rather than adding one each time.
  const filterFrom = (date: string) =>
    update({ fromDate: date || undefined, page: 1 }, { replace: true })
  const filterTo = (date: string) =>
    update({ toDate: date || undefined, page: 1 }, { replace: true })
  const clearDates = () =>
    update({ fromDate: undefined, toDate: undefined, page: 1 })
  const clearFilters = () =>
    update({
      keyword: undefined,
      status: undefined,
      fromDate: undefined,
      toDate: undefined,
      page: 1,
    })

  const isFiltered = Boolean(
    params.keyword || params.status || params.fromDate || params.toDate,
  )
  const invoices = data?.data ?? []
  const total = data?.paging.total ?? 0

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 } }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <Typography variant="h4" component="h1">
            Invoices
          </Typography>
          {data && !rangeInverted && (
            <Typography color="text.secondary" aria-live="polite">
              {total === 1 ? '1 invoice' : `${total} invoices`}
            </Typography>
          )}
        </Box>
        <Button
          component={Link}
          to={NEW_INVOICE_PATH}
          state={fromList}
          variant="contained"
          startIcon={<AddIcon />}
        >
          New invoice
        </Button>
      </Box>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ mb: 2, alignItems: { md: 'flex-start' } }}
      >
        <SearchField value={params.keyword ?? ''} onSearch={search} />
        <TextField
          select
          label="Status"
          size="small"
          value={params.status ?? ALL_STATUSES}
          onChange={(event) => filterByStatus(event.target.value)}
          sx={{ minWidth: { md: 150 } }}
        >
          <MenuItem value={ALL_STATUSES}>All</MenuItem>
          {INVOICE_STATUSES.map((status) => (
            <MenuItem key={status} value={status}>
              {status}
            </MenuItem>
          ))}
        </TextField>
        {/* The two ends of the invoice date range share a row on phones. */}
        <Stack direction="row" spacing={2}>
          <TextField
            label="Invoiced from"
            type="date"
            size="small"
            fullWidth
            value={params.fromDate ?? ''}
            onChange={(event) => filterFrom(event.target.value)}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { max: params.toDate ?? MAX_DATE },
            }}
            sx={{ minWidth: { md: 160 } }}
          />
          <TextField
            label="Invoiced to"
            type="date"
            size="small"
            fullWidth
            value={params.toDate ?? ''}
            onChange={(event) => filterTo(event.target.value)}
            error={rangeInverted}
            helperText={rangeInverted ? 'Before the from date' : undefined}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { min: params.fromDate, max: MAX_DATE },
            }}
            sx={{ minWidth: { md: 160 } }}
          />
        </Stack>
        {isPhone && (
          <TextField
            select
            label="Sort by"
            size="small"
            value={`${params.sortBy}:${params.ordering}`}
            onChange={(event) => {
              const [field, ordering] = event.target.value.split(':')
              sortBy(field as SortField, ordering as SortOrder)
            }}
          >
            {SORT_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Stack>

      {/* Reserves its height so the list does not jump when a fetch starts. */}
      <Box sx={{ height: 4, mb: 1 }}>
        {isFetching && <LinearProgress aria-label="Loading invoices" />}
      </Box>

      {rangeInverted ? (
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={clearDates}>
              Clear dates
            </Button>
          }
        >
          The date range ends before it starts. Change one of the dates to see
          invoices.
        </Alert>
      ) : isError ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          Could not load invoices. {getErrorMessages(error).join(' ')}
        </Alert>
      ) : isPending ? null : invoices.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography gutterBottom>
            {isFiltered
              ? 'No invoices match your search or filter.'
              : total > 0
                ? 'There are no invoices on this page.'
                : 'There are no invoices yet.'}
          </Typography>
          {isFiltered ? (
            <Button onClick={clearFilters}>Clear filters</Button>
          ) : (
            total > 0 && (
              <Button onClick={() => update({ page: 1 })}>
                Go to the first page
              </Button>
            )
          )}
        </Paper>
      ) : (
        <>
          {isPhone ? (
            <InvoiceCards invoices={invoices} />
          ) : (
            <InvoiceTable
              invoices={invoices}
              sortBy={params.sortBy}
              ordering={params.ordering}
              onSort={toggleSort}
            />
          )}
          <TablePagination
            component="div"
            count={total}
            page={params.page - 1}
            rowsPerPage={params.pageSize}
            rowsPerPageOptions={PAGE_SIZE_OPTIONS}
            onPageChange={(_event, page) => update({ page: page + 1 })}
            onRowsPerPageChange={(event) =>
              update({ pageSize: Number(event.target.value), page: 1 })
            }
          />
        </>
      )}
    </Container>
  )
}

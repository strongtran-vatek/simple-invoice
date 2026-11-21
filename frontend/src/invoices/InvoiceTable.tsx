import MuiLink from '@mui/material/Link'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import { Link } from 'react-router'
import type { InvoiceSummary, SortField, SortOrder } from '../api/invoices'
import { formatDate, formatMoney } from './format'
import { invoicePath, useFromListState } from './invoiceLinks'
import { StatusChip } from './StatusChip'

interface InvoiceTableProps {
  invoices: InvoiceSummary[]
  sortBy: SortField
  ordering: SortOrder
  onSort(field: SortField): void
}

/** The invoice list as a table, for screens wide enough to show six columns. */
export function InvoiceTable({
  invoices,
  sortBy,
  ordering,
  onSort,
}: InvoiceTableProps) {
  const direction = ordering === 'ASC' ? 'asc' : 'desc'
  const fromList = useFromListState()

  const sortableHeader = (field: SortField, label: string, align?: 'right') => (
    <TableCell
      align={align}
      sortDirection={sortBy === field ? direction : false}
    >
      <TableSortLabel
        active={sortBy === field}
        direction={sortBy === field ? direction : 'asc'}
        onClick={() => onSort(field)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  )

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table aria-label="Invoices">
        <TableHead>
          <TableRow>
            <TableCell>Invoice number</TableCell>
            <TableCell>Customer</TableCell>
            {sortableHeader('invoiceDate', 'Invoice date')}
            {sortableHeader('dueDate', 'Due date')}
            {sortableHeader('totalAmount', 'Total', 'right')}
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.invoiceId} hover>
              <TableCell>
                <MuiLink
                  component={Link}
                  to={invoicePath(invoice.invoiceId)}
                  state={fromList}
                  underline="hover"
                  sx={{ fontWeight: 600 }}
                >
                  {invoice.invoiceNumber}
                </MuiLink>
              </TableCell>
              <TableCell>{invoice.customer.fullname}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {formatDate(invoice.invoiceDate)}
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {formatDate(invoice.dueDate)}
              </TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                {formatMoney(invoice.totalAmount, invoice.currencySymbol)}
              </TableCell>
              <TableCell>
                <StatusChip status={invoice.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

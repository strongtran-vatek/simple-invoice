import Chip from '@mui/material/Chip'
import type { InvoiceStatus } from '../api/invoices'

const COLOURS = {
  Draft: 'default',
  Pending: 'info',
  Paid: 'success',
  Overdue: 'error',
} as const satisfies Record<InvoiceStatus, string>

/** The invoice's status as a coloured label. The text carries the meaning; colour only reinforces it. */
export function StatusChip({ status }: { status: InvoiceStatus }) {
  return (
    <Chip
      label={status}
      color={COLOURS[status]}
      size="small"
      variant={status === 'Draft' ? 'outlined' : 'filled'}
    />
  )
}

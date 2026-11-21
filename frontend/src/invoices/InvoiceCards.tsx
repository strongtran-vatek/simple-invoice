import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { InvoiceSummary } from '../api/invoices'
import { formatDate, formatMoney } from './format'
import { StatusChip } from './StatusChip'

/** The invoice list as stacked cards, for phone-width screens. */
export function InvoiceCards({ invoices }: { invoices: InvoiceSummary[] }) {
  return (
    <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
      {invoices.map((invoice) => (
        <Card
          key={invoice.invoiceId}
          component="li"
          variant="outlined"
          aria-label={`Invoice ${invoice.invoiceNumber}`}
        >
          <CardContent sx={{ '&:last-child': { pb: 2 } }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                {invoice.invoiceNumber}
              </Typography>
              <StatusChip status={invoice.status} />
            </Box>
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              {invoice.customer.fullname}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                gap: 1,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Issued {formatDate(invoice.invoiceDate)}
                <br />
                Due {formatDate(invoice.dueDate)}
              </Typography>
              <Typography sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                {formatMoney(invoice.totalAmount, invoice.currencySymbol)}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Stack>
  )
}

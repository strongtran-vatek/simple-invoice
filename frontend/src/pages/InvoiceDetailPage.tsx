import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import { useTheme } from '@mui/material/styles'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useQuery } from '@tanstack/react-query'
import { type ReactNode, useId } from 'react'
import { Link, useParams } from 'react-router'
import { getErrorMessages, getErrorStatus } from '../api/errors'
import { fetchInvoice, type InvoiceDetail } from '../api/invoices'
import { formatDate, formatMoney } from '../invoices/format'
import { useBackToListPath } from '../invoices/invoiceLinks'
import { StatusChip } from '../invoices/StatusChip'

/** Shown in place of an optional value that was not provided. */
const EMPTY = '—'

/** A titled panel, exposed to assistive technology as a named region. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId()
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby={headingId}
      sx={{ p: { xs: 2, sm: 3 } }}
    >
      <Typography id={headingId} variant="h6" component="h2" gutterBottom>
        {title}
      </Typography>
      {children}
    </Paper>
  )
}

/** A list of label and value pairs. */
function Fields({ fields }: { fields: [label: string, value: ReactNode][] }) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'grid',
        gridTemplateColumns: 'minmax(110px, max-content) 1fr',
        columnGap: 2,
        rowGap: 1,
      }}
    >
      {fields.map(([label, value]) => (
        <Box key={label} sx={{ display: 'contents' }}>
          <Typography component="dt" variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography
            component="dd"
            variant="body2"
            sx={{ m: 0, overflowWrap: 'anywhere' }}
          >
            {value ?? EMPTY}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

function InvoiceDetails({ invoice }: { invoice: InvoiceDetail }) {
  const money = (amount: number) => formatMoney(amount, invoice.currencySymbol)
  const isPhone = useMediaQuery(useTheme().breakpoints.down('sm'))

  const amounts: [label: string, value: string, emphasised?: boolean][] = [
    ['Subtotal', money(invoice.invoiceSubTotal)],
    [`Tax (${invoice.taxRate}%)`, money(invoice.totalTax)],
    // A discount reduces the total, so it is shown as a negative amount.
    [
      'Discount',
      money(invoice.totalDiscount === 0 ? 0 : -invoice.totalDiscount),
    ],
    ['Total', money(invoice.totalAmount), true],
    ['Paid', money(invoice.totalPaid)],
    ['Outstanding balance', money(invoice.balanceAmount), true],
  ]

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1.5,
          mb: 3,
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          sx={{ overflowWrap: 'anywhere' }}
        >
          Invoice {invoice.invoiceNumber}
        </Typography>
        <StatusChip status={invoice.status} />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          // minmax(0, 1fr), not 1fr: a plain 1fr column refuses to shrink
          // below its content, which pushed the page wider than a phone.
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            md: 'repeat(2, minmax(0, 1fr))',
          },
        }}
      >
        <Section title="Invoice information">
          <Fields
            fields={[
              ['Invoice number', invoice.invoiceNumber],
              ['Reference', invoice.invoiceReference],
              ['Invoice date', formatDate(invoice.invoiceDate)],
              ['Due date', formatDate(invoice.dueDate)],
              ['Currency', invoice.currency],
              ['Status', invoice.status],
              ['Description', invoice.description],
            ]}
          />
        </Section>

        <Section title="Customer">
          <Fields
            fields={[
              ['Name', invoice.customer.fullname],
              ['Email', invoice.customer.email],
              ['Mobile', invoice.customer.mobileNumber],
              ['Address', invoice.customer.address],
            ]}
          />
        </Section>

        <Box sx={{ gridColumn: '1 / -1' }}>
          <Section title="Line items">
            {isPhone ? (
              // Four columns do not fit a phone, so each item is stacked instead.
              <Box
                component="ul"
                aria-label="Line items"
                sx={{ listStyle: 'none', p: 0, m: 0 }}
              >
                {invoice.items.map((item) => (
                  <Box
                    component="li"
                    key={item.id}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-end',
                      gap: 2,
                      py: 1,
                    }}
                  >
                    <Box>
                      <Typography sx={{ overflowWrap: 'anywhere' }}>
                        {item.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.quantity} × {money(item.rate)}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {money(item.amount)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <TableContainer>
                <Table size="small" aria-label="Line items">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell align="right">Rate</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invoice.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          {money(item.rate)}
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          {money(item.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Section>
        </Box>

        <Box sx={{ gridColumn: { md: '2' } }}>
          <Section title="Amounts">
            <Box component="dl" sx={{ m: 0 }}>
              {amounts.map(([label, value, emphasised]) => (
                <Box
                  key={label}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 2,
                    py: 0.5,
                    fontWeight: emphasised ? 600 : 400,
                    borderTop: emphasised ? 1 : 0,
                    borderColor: 'divider',
                  }}
                >
                  <Box component="dt">{label}</Box>
                  <Box component="dd" sx={{ m: 0, whiteSpace: 'nowrap' }}>
                    {value}
                  </Box>
                </Box>
              ))}
            </Box>
          </Section>
        </Box>
      </Box>
    </>
  )
}

/** Everything recorded about one invoice. */
export function InvoiceDetailPage() {
  const { invoiceId = '' } = useParams()
  const backToList = useBackToListPath()

  const { data, error, isPending, isError, refetch } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => fetchInvoice(invoiceId),
  })

  // The backend answers 404 for an unknown id and 400 for one that is not a
  // UUID. Either way there is no such invoice to show.
  const status = getErrorStatus(error)
  const notFound = status === 404 || status === 400

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
      <Button
        component={Link}
        to={backToList}
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2 }}
      >
        Back to invoices
      </Button>

      {isPending ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress aria-label="Loading invoice" />
        </Box>
      ) : notFound ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" component="h1" gutterBottom>
            Invoice not found
          </Typography>
          <Typography color="text.secondary">
            It may have been removed, or the link may be wrong.
          </Typography>
        </Paper>
      ) : isError ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          Could not load the invoice. {getErrorMessages(error).join(' ')}
        </Alert>
      ) : (
        <InvoiceDetails invoice={data} />
      )}
    </Container>
  )
}

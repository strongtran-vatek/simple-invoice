import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'

/** Home screen after sign-in. The invoice table arrives in the next slice. */
export function InvoiceListPage() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Invoices
      </Typography>
      <Typography color="text.secondary">
        The invoice list arrives in the next slice.
      </Typography>
    </Container>
  )
}

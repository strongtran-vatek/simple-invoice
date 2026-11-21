import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'

/** Placeholder landing page. The Invoice List replaces it in a later slice. */
export function HomePage() {
  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        SimpleInvoice
      </Typography>
      <Typography color="text.secondary">
        The application is set up. Sign-in and invoices arrive in the next
        slices.
      </Typography>
    </Container>
  )
}

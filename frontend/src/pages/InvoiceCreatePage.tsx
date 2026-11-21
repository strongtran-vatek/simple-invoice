import { zodResolver } from '@hookform/resolvers/zod'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import InputAdornment from '@mui/material/InputAdornment'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { type FieldPath, useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { getErrorMessages, getErrorStatus } from '../api/errors'
import { createInvoice } from '../api/invoices'
import { useNotify } from '../app/NotificationContext'
import {
  CURRENCIES,
  defaultInvoiceForm,
  type InvoiceFormValues,
  invoiceFormSchema,
  toCreateInvoiceRequest,
  type ValidInvoiceForm,
} from '../invoices/invoiceForm'
import { invoicePath, useBackToListPath } from '../invoices/invoiceLinks'

/** A titled group of fields, laid out two to a row where there is room. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId()
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby={headingId}
      sx={{ p: { xs: 2, sm: 3 } }}
    >
      <Typography id={headingId} variant="h6" component="h2" sx={{ mb: 2 }}>
        {title}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            sm: 'repeat(2, minmax(0, 1fr))',
          },
        }}
      >
        {children}
      </Box>
    </Paper>
  )
}

/** Makes a field span the full width of its section. */
const FULL_WIDTH = { gridColumn: '1 / -1' }

/** The form for creating an invoice. The backend calculates its totals. */
export function InvoiceCreatePage() {
  const navigate = useNavigate()
  const notify = useNotify()
  const queryClient = useQueryClient()
  const backToList = useBackToListPath()
  const [submitErrors, setSubmitErrors] = useState<string[]>([])
  const errorAlert = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceFormValues, unknown, ValidInvoiceForm>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: defaultInvoiceForm(),
  })

  // The alert sits above a long form, so bring it into view when it appears.
  useEffect(() => {
    if (submitErrors.length > 0) {
      errorAlert.current?.scrollIntoView?.({ block: 'center' })
    }
  }, [submitErrors])

  /** Connects a text field to the form: value, validation message and focus. */
  const field = (
    name: FieldPath<InvoiceFormValues>,
    options?: Parameters<typeof register>[1],
  ) => {
    // MUI wants the input's ref separately, so an invalid field can be focused.
    const { ref, ...registration } = register(name, options)
    return {
      ...registration,
      inputRef: ref,
      error: Boolean(errors[name]),
      helperText: errors[name]?.message,
      fullWidth: true,
    }
  }

  const onSubmit = handleSubmit(async (form) => {
    setSubmitErrors([])
    try {
      const invoice = await createInvoice(toCreateInvoiceRequest(form))
      // Cached list pages no longer include every invoice, so drop them.
      queryClient.removeQueries({ queryKey: ['invoices'] })
      notify({
        message: `Invoice ${invoice.invoiceNumber} created`,
        action: { label: 'View', to: invoicePath(invoice.invoiceId) },
      })
      navigate('/invoices')
    } catch (error) {
      const [message, ...rest] = getErrorMessages(error)
      if (getErrorStatus(error) === 409) {
        // The number is taken: say so on the field that has to change.
        setError(
          'invoiceNumber',
          { type: 'server', message },
          { shouldFocus: true },
        )
      } else {
        setSubmitErrors([message, ...rest])
      }
    }
  })

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

      <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
        New invoice
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        The invoice is saved as a Draft. Its totals are calculated when you save
        it.
      </Typography>

      <Box component="form" noValidate onSubmit={onSubmit}>
        <Stack spacing={2}>
          {submitErrors.length > 0 && (
            <Alert severity="error" ref={errorAlert}>
              The invoice was not created.
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {submitErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </Box>
            </Alert>
          )}

          <Section title="Invoice">
            <TextField
              label="Invoice number"
              required
              autoFocus
              {...field('invoiceNumber')}
            />
            <TextField label="Reference" {...field('invoiceReference')} />
            <TextField
              label="Invoice date"
              type="date"
              required
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { max: '9999-12-31' },
              }}
              // Moving the invoice date can make the due date valid or invalid.
              {...field('invoiceDate', { deps: ['dueDate'] })}
            />
            <TextField
              label="Due date"
              type="date"
              required
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { max: '9999-12-31' },
              }}
              {...field('dueDate')}
            />
            <TextField
              label="Currency"
              select
              required
              // A native select: the phone's own picker, and no extra code.
              slotProps={{ select: { native: true } }}
              {...field('currency')}
            >
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </TextField>
            <TextField
              label="Description"
              multiline
              minRows={2}
              sx={FULL_WIDTH}
              {...field('description')}
            />
          </Section>

          <Section title="Customer">
            <TextField
              label="Customer name"
              required
              autoComplete="off"
              {...field('customerName')}
            />
            <TextField
              label="Customer email"
              type="email"
              required
              autoComplete="off"
              {...field('customerEmail')}
            />
            <TextField
              label="Mobile"
              type="tel"
              autoComplete="off"
              {...field('customerMobile')}
            />
            <TextField
              label="Address"
              autoComplete="off"
              {...field('customerAddress')}
            />
          </Section>

          <Section title="Line item">
            <TextField
              label="Item name"
              required
              sx={FULL_WIDTH}
              {...field('itemName')}
            />
            <TextField
              label="Quantity"
              required
              slotProps={{ htmlInput: { inputMode: 'numeric' } }}
              {...field('quantity')}
            />
            <TextField
              label="Rate"
              required
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              {...field('rate')}
              helperText={errors.rate?.message ?? 'Price per unit'}
            />
            <TextField
              label="Tax"
              required
              slotProps={{
                htmlInput: { inputMode: 'decimal' },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">%</InputAdornment>
                  ),
                },
              }}
              {...field('tax')}
            />
            <TextField
              label="Discount"
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              {...field('discount')}
              helperText={
                errors.discount?.message ?? 'An amount, not a percentage'
              }
            />
          </Section>

          <Stack
            direction={{ xs: 'column-reverse', sm: 'row' }}
            spacing={2}
            sx={{ justifyContent: 'flex-end' }}
          >
            <Button component={Link} to={backToList} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating…' : 'Create invoice'}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Container>
  )
}

import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { tokenStorage } from '../auth/tokenStorage'
import { currentUrl, renderApp, setPhoneViewport } from '../test/renderApp'
import {
  API_URL,
  detailOf,
  server,
  TEST_INVOICES,
  TEST_PASSWORD,
  TEST_TOKEN,
  TEST_USER,
} from '../test/server'

/** INV-0022: Pending, a quarter paid, with every optional field filled in. */
const COMPLETE = TEST_INVOICES[21]
/** INV-0023: Paid in full, with no optional fields. */
const MINIMAL = TEST_INVOICES[22]

async function openInvoice(invoiceId: string) {
  tokenStorage.set(TEST_TOKEN)
  return renderApp(`/invoices/${invoiceId}`)
}

/** The label and value pairs listed in a section, e.g. `{ Name: 'Alice Johnson' }`. */
function fieldsIn(sectionName: string): Record<string, string> {
  const section = screen.getByRole('region', { name: sectionName })
  return Object.fromEntries(
    within(section)
      .getAllByRole('term')
      .map((term) => [
        term.textContent,
        term.nextElementSibling?.textContent ?? '',
      ]),
  )
}

describe('InvoiceDetailPage', () => {
  it('shows the invoice number and status at the top', async () => {
    await openInvoice(COMPLETE.invoiceId)

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'Invoice INV-0022',
    })
    expect(heading.parentElement).toHaveTextContent('Pending')
  })

  it('shows the invoice information', async () => {
    await openInvoice(COMPLETE.invoiceId)
    await screen.findByRole('heading', { name: 'Invoice INV-0022' })

    expect(fieldsIn('Invoice information')).toEqual({
      'Invoice number': 'INV-0022',
      Reference: 'PO-22',
      'Invoice date': '22 Jun 2026',
      'Due date': '22 Jul 2026',
      Currency: 'AUD',
      Status: 'Pending',
      Description: 'Monthly service, batch 22',
    })
  })

  it('shows the customer information', async () => {
    await openInvoice(COMPLETE.invoiceId)
    await screen.findByRole('heading', { name: 'Invoice INV-0022' })

    expect(fieldsIn('Customer')).toEqual({
      Name: 'Alice Johnson',
      Email: 'customer@example.com',
      Mobile: '0412345678',
      Address: '1 Harbour Street, Sydney',
    })
  })

  it('shows the line items', async () => {
    await openInvoice(COMPLETE.invoiceId)

    const table = await screen.findByRole('table', { name: 'Line items' })
    const [header, ...rows] = within(table).getAllByRole('row')

    expect(
      within(header)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Item', 'Quantity', 'Rate', 'Amount'])
    expect(rows).toHaveLength(1)
    expect(
      within(rows[0])
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['Service package', '22', 'AU$100.00', 'AU$2,200.00'])
  })

  it('stacks the line items on a phone instead of using a table', async () => {
    setPhoneViewport(true)
    await openInvoice(COMPLETE.invoiceId)

    const list = await screen.findByRole('list', { name: 'Line items' })
    const items = within(list).getAllByRole('listitem')

    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent('Service package')
    expect(items[0]).toHaveTextContent('22 × AU$100.00')
    expect(items[0]).toHaveTextContent('AU$2,200.00')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows subtotal, tax, discount, total and outstanding balance', async () => {
    await openInvoice(COMPLETE.invoiceId)
    await screen.findByRole('heading', { name: 'Invoice INV-0022' })

    expect(fieldsIn('Amounts')).toEqual({
      Subtotal: 'AU$2,200.00',
      'Tax (10%)': 'AU$220.00',
      Discount: '-AU$220.00',
      Total: 'AU$2,200.00',
      Paid: 'AU$550.00',
      'Outstanding balance': 'AU$1,650.00',
    })
  })

  it('shows the amounts the backend sent, without recalculating them', async () => {
    // Figures that deliberately do not add up: the page must not "correct" them.
    server.use(
      http.get(`${API_URL}/invoices/:invoiceId`, () =>
        HttpResponse.json({
          ...detailOf(COMPLETE),
          taxRate: 8.25,
          invoiceSubTotal: 1,
          totalTax: 2,
          totalDiscount: 0,
          totalAmount: 99,
          totalPaid: 5,
          balanceAmount: 7,
        }),
      ),
    )
    await openInvoice(COMPLETE.invoiceId)
    await screen.findByRole('heading', { name: 'Invoice INV-0022' })

    expect(fieldsIn('Amounts')).toEqual({
      Subtotal: 'AU$1.00',
      'Tax (8.25%)': 'AU$2.00',
      Discount: 'AU$0.00',
      Total: 'AU$99.00',
      Paid: 'AU$5.00',
      'Outstanding balance': 'AU$7.00',
    })
  })

  it('shows a dash for optional fields that are empty', async () => {
    await openInvoice(MINIMAL.invoiceId)
    await screen.findByRole('heading', { name: 'Invoice INV-0023' })

    expect(fieldsIn('Invoice information')).toMatchObject({
      Reference: '—',
      Description: '—',
    })
    expect(fieldsIn('Customer')).toMatchObject({ Mobile: '—', Address: '—' })
  })

  it('shows a paid invoice with nothing outstanding', async () => {
    await openInvoice(MINIMAL.invoiceId)
    await screen.findByRole('heading', { name: 'Invoice INV-0023' })

    expect(fieldsIn('Amounts')).toMatchObject({
      Paid: 'AU$2,300.00',
      'Outstanding balance': 'AU$0.00',
    })
  })

  describe('reaching it from the list', () => {
    it('opens when an invoice number is clicked, and Back restores the list', async () => {
      tokenStorage.set(TEST_TOKEN)
      const { user } = renderApp('/invoices?keyword=alice&status=Pending')

      await user.click(await screen.findByRole('link', { name: 'INV-0022' }))

      expect(
        await screen.findByRole('heading', { name: 'Invoice INV-0022' }),
      ).toBeInTheDocument()
      expect(currentUrl()).toBe(`/invoices/${COMPLETE.invoiceId}`)

      await user.click(screen.getByRole('link', { name: 'Back to invoices' }))

      expect(
        await screen.findByRole('heading', { name: 'Invoices' }),
      ).toBeInTheDocument()
      expect(currentUrl()).toBe('/invoices?keyword=alice&status=Pending')
    })

    it('opens when a card is tapped on a phone', async () => {
      setPhoneViewport(true)
      tokenStorage.set(TEST_TOKEN)
      const { user } = renderApp('/invoices')

      const card = (await screen.findAllByRole('listitem'))[0]
      await user.click(within(card).getByRole('link'))

      expect(
        await screen.findByRole('heading', { name: 'Invoice INV-0023' }),
      ).toBeInTheDocument()
    })

    it('leads back to the default list when opened from a link', async () => {
      const { user } = await openInvoice(COMPLETE.invoiceId)
      await screen.findByRole('heading', { name: 'Invoice INV-0022' })

      await user.click(screen.getByRole('link', { name: 'Back to invoices' }))

      await screen.findByRole('heading', { name: 'Invoices' })
      expect(currentUrl()).toBe('/invoices')
    })
  })

  describe('when the invoice cannot be shown', () => {
    it('says so for an id that does not exist', async () => {
      await openInvoice('3f2504e0-4f89-41d3-9a0c-0305e82c3301')

      expect(
        await screen.findByRole('heading', { name: 'Invoice not found' }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('link', { name: 'Back to invoices' }),
      ).toHaveAttribute('href', '/invoices')
    })

    it('says so for an id that is not a UUID', async () => {
      await openInvoice('not-a-uuid')

      expect(
        await screen.findByRole('heading', { name: 'Invoice not found' }),
      ).toBeInTheDocument()
    })

    it('shows the error and retries on request', async () => {
      let failing = true
      server.use(
        http.get(`${API_URL}/invoices/:invoiceId`, () => {
          if (!failing) return undefined // fall through to the working handler
          return HttpResponse.json(
            { statusCode: 500, message: 'Internal server error' },
            { status: 500 },
          )
        }),
      )
      const { user } = await openInvoice(COMPLETE.invoiceId)

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Could not load the invoice. Internal server error',
      )

      failing = false
      await user.click(screen.getByRole('button', { name: 'Retry' }))

      expect(
        await screen.findByRole('heading', { name: 'Invoice INV-0022' }),
      ).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  it('shows a progress indicator while loading', async () => {
    await openInvoice(COMPLETE.invoiceId)

    expect(await screen.findByLabelText('Loading invoice')).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByLabelText('Loading invoice'),
      ).not.toBeInTheDocument(),
    )
  })

  it('asks a signed-out visitor to sign in, then shows the invoice they asked for', async () => {
    const { user } = renderApp(`/invoices/${COMPLETE.invoiceId}`)

    await user.type(
      await screen.findByLabelText('Email address'),
      TEST_USER.email,
    )
    await user.type(screen.getByLabelText('Password'), TEST_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(
      await screen.findByRole('heading', { name: 'Invoice INV-0022' }),
    ).toBeInTheDocument()
  })
})

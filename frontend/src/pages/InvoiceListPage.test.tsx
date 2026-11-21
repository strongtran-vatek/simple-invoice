import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { tokenStorage } from '../auth/tokenStorage'
import { currentUrl, renderApp, setPhoneViewport } from '../test/renderApp'
import {
  API_URL,
  invoiceListRequests,
  server,
  TEST_TOKEN,
} from '../test/server'

/** Opens the list as a signed-in user and waits for its first rows. */
async function openList(path = '/invoices') {
  tokenStorage.set(TEST_TOKEN)
  const view = renderApp(path)
  await screen.findByRole('heading', { name: 'Invoices' })
  return view
}

/** The invoice numbers shown, in order, read from the first column. */
function shownNumbers(): string[] {
  const [, ...rows] = within(
    screen.getByRole('table', { name: 'Invoices' }),
  ).getAllByRole('row')
  return rows.map((row) => within(row).getAllByRole('cell')[0].textContent)
}

const lastRequest = () =>
  Object.fromEntries(invoiceListRequests[invoiceListRequests.length - 1])

const waitForNumbers = (expected: string[]) =>
  waitFor(() => expect(shownNumbers()).toEqual(expected))

const range = (from: number, to: number) =>
  Array.from({ length: Math.abs(to - from) + 1 }, (_, index) => {
    const n = from < to ? from + index : from - index
    return `INV-00${String(n).padStart(2, '0')}`
  })

describe('InvoiceListPage', () => {
  describe('on first load', () => {
    it('asks for the first page of 10, newest invoice date first', async () => {
      await openList()

      await waitForNumbers(range(23, 14))
      expect(invoiceListRequests).toHaveLength(1)
      expect(lastRequest()).toEqual({
        page: '1',
        pageSize: '10',
        sortBy: 'invoiceDate',
        ordering: 'DESC',
      })
    })

    it('shows the key fields of each invoice, formatted', async () => {
      await openList()
      await waitForNumbers(range(23, 14))

      const row = screen.getByRole('row', { name: /INV-0023/ })
      const cells = within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)

      expect(cells).toEqual([
        'INV-0023',
        'Bob Stone',
        '23 Jun 2026',
        '23 Jul 2026',
        'AU$2,300.00',
        'Paid',
      ])
    })

    it('labels every column', async () => {
      await openList()
      await waitForNumbers(range(23, 14))

      expect(
        screen.getAllByRole('columnheader').map((header) => header.textContent),
      ).toEqual([
        'Invoice number',
        'Customer',
        expect.stringContaining('Invoice date'),
        'Due date',
        'Total',
        'Status',
      ])
    })

    it('shows how many invoices there are in total', async () => {
      await openList()

      expect(await screen.findByText('23 invoices')).toBeInTheDocument()
      expect(screen.getByText('1–10 of 23')).toBeInTheDocument()
    })
  })

  describe('search', () => {
    it('sends one request once typing pauses, and shows the matches', async () => {
      const { user } = await openList()
      await waitForNumbers(range(23, 14))

      await user.type(screen.getByLabelText('Search'), 'carol')

      await waitFor(() => expect(lastRequest().keyword).toBe('carol'))
      // One request for the initial load, one for the finished word.
      expect(invoiceListRequests).toHaveLength(2)
      await waitFor(() =>
        expect(screen.getByText('7 invoices')).toBeInTheDocument(),
      )
      for (const row of screen.getAllByRole('row').slice(1)) {
        expect(row).toHaveTextContent('Carol White')
      }
      expect(currentUrl()).toBe('/invoices?keyword=carol')
    })

    it('trims the text and returns to the first page', async () => {
      const { user } = await openList('/invoices?page=2')
      await waitForNumbers(range(13, 4))

      await user.type(screen.getByLabelText('Search'), '  inv-000  ')

      await waitFor(() => expect(lastRequest().keyword).toBe('inv-000'))
      expect(lastRequest().page).toBe('1')
    })

    it('removes the keyword when the box is cleared', async () => {
      const { user } = await openList('/invoices?keyword=bob')
      await waitFor(() => expect(lastRequest().keyword).toBe('bob'))

      await user.clear(screen.getByLabelText('Search'))

      await waitFor(() => expect(lastRequest().keyword).toBeUndefined())
      expect(currentUrl()).toBe('/invoices')
    })
  })

  describe('status filter', () => {
    it.each(['Draft', 'Pending', 'Paid', 'Overdue'])(
      'filters by %s',
      async (status) => {
        const { user } = await openList()
        await waitForNumbers(range(23, 14))

        await user.click(screen.getByRole('combobox', { name: 'Status' }))
        await user.click(screen.getByRole('option', { name: status }))

        await waitFor(() => expect(lastRequest().status).toBe(status))
        expect(currentUrl()).toBe(`/invoices?status=${status}`)
        await waitFor(() => {
          const rows = screen.getAllByRole('row').slice(1)
          expect(rows.length).toBeGreaterThan(0)
          for (const row of rows) {
            expect(within(row).getAllByRole('cell')[5]).toHaveTextContent(
              status,
            )
          }
        })
      },
    )

    it('offers All, which removes the filter', async () => {
      const { user } = await openList('/invoices?status=Paid')
      await waitFor(() => expect(lastRequest().status).toBe('Paid'))

      await user.click(screen.getByRole('combobox', { name: 'Status' }))
      await user.click(screen.getByRole('option', { name: 'All' }))

      await waitFor(() => expect(lastRequest().status).toBeUndefined())
      expect(currentUrl()).toBe('/invoices')
    })

    it('returns to the first page', async () => {
      const { user } = await openList('/invoices?page=2')
      await waitForNumbers(range(13, 4))

      await user.click(screen.getByRole('combobox', { name: 'Status' }))
      await user.click(screen.getByRole('option', { name: 'Draft' }))

      await waitFor(() => expect(lastRequest().status).toBe('Draft'))
      expect(lastRequest().page).toBe('1')
    })
  })

  describe('date range filter', () => {
    const fromField = () => screen.getByLabelText('Invoiced from')
    const toField = () => screen.getByLabelText('Invoiced to')

    it('shows only invoices dated within the range, both ends included', async () => {
      const { user } = await openList()
      await waitForNumbers(range(23, 14))

      await user.type(fromField(), '2026-06-05')
      await user.type(toField(), '2026-06-08')

      await waitForNumbers(range(8, 5))
      expect(lastRequest()).toMatchObject({
        fromDate: '2026-06-05',
        toDate: '2026-06-08',
      })
      expect(screen.getByText('4 invoices')).toBeInTheDocument()
      expect(currentUrl()).toBe(
        '/invoices?fromDate=2026-06-05&toDate=2026-06-08',
      )
    })

    it('works with only one end', async () => {
      const { user } = await openList()
      await waitForNumbers(range(23, 14))

      await user.type(fromField(), '2026-06-20')

      await waitForNumbers(range(23, 20))
      expect(lastRequest()).not.toHaveProperty('toDate')
    })

    it('returns to the first page', async () => {
      const { user } = await openList('/invoices?page=2')
      await waitForNumbers(range(13, 4))

      await user.type(toField(), '2026-06-12')

      await waitForNumbers(range(12, 3))
      expect(lastRequest().page).toBe('1')
    })

    it('combines with search and status, and is restored from a link', async () => {
      await openList(
        '/invoices?status=Paid&fromDate=2026-06-01&toDate=2026-06-12',
      )

      // Every fourth invoice is Paid: 3, 7 and 11 fall inside the range.
      await waitForNumbers(['INV-0011', 'INV-0007', 'INV-0003'])
      expect(fromField()).toHaveValue('2026-06-01')
      expect(toField()).toHaveValue('2026-06-12')
    })

    it('is removed when a date is cleared', async () => {
      const { user } = await openList('/invoices?fromDate=2026-06-20')
      await waitForNumbers(range(23, 20))

      await user.clear(fromField())

      await waitForNumbers(range(23, 14))
      expect(currentUrl()).toBe('/invoices')
    })

    it('is cleared together with the other filters', async () => {
      const { user } = await openList(
        '/invoices?fromDate=2027-01-01&toDate=2027-01-31',
      )

      await user.click(
        await screen.findByRole('button', { name: 'Clear filters' }),
      )

      await waitForNumbers(range(23, 14))
      expect(fromField()).toHaveValue('')
      expect(toField()).toHaveValue('')
    })

    it('limits each date picker by the other end', async () => {
      await openList('/invoices?fromDate=2026-06-05&toDate=2026-06-08')
      await waitForNumbers(range(8, 5))

      expect(fromField()).toHaveAttribute('max', '2026-06-08')
      expect(toField()).toHaveAttribute('min', '2026-06-05')
    })

    it('asks for a range that ends before it starts to be corrected, without calling the backend', async () => {
      const { user } = await openList(
        '/invoices?fromDate=2026-06-10&toDate=2026-06-01',
      )

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The date range ends before it starts',
      )
      expect(toField()).toBeInvalid()
      expect(toField()).toHaveAccessibleDescription('Before the from date')
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      expect(invoiceListRequests).toHaveLength(0)

      await user.click(screen.getByRole('button', { name: 'Clear dates' }))

      await waitForNumbers(range(23, 14))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('ignores a date in the link that is not a date', async () => {
      await openList('/invoices?fromDate=last-week')

      await waitForNumbers(range(23, 14))
      expect(lastRequest()).not.toHaveProperty('fromDate')
    })
  })

  describe('sorting', () => {
    it.each([
      ['Invoice date', 'invoiceDate'],
      ['Due date', 'dueDate'],
      ['Total', 'totalAmount'],
    ])('sorts by %s, ascending then descending', async (label, field) => {
      // Start from another column so the first click always switches column.
      const start = field === 'dueDate' ? 'totalAmount' : 'dueDate'
      const { user } = await openList(`/invoices?sortBy=${start}&ordering=DESC`)
      await waitForNumbers(range(23, 14))

      await user.click(screen.getByRole('button', { name: label }))
      await waitFor(() =>
        expect(lastRequest()).toMatchObject({ sortBy: field, ordering: 'ASC' }),
      )
      await waitForNumbers(range(1, 10))
      expect(screen.getByRole('columnheader', { name: label })).toHaveAttribute(
        'aria-sort',
        'ascending',
      )

      await user.click(screen.getByRole('button', { name: label }))
      await waitFor(() =>
        expect(lastRequest()).toMatchObject({
          sortBy: field,
          ordering: 'DESC',
        }),
      )
      await waitForNumbers(range(23, 14))
      expect(screen.getByRole('columnheader', { name: label })).toHaveAttribute(
        'aria-sort',
        'descending',
      )
    })

    it('returns to the first page', async () => {
      const { user } = await openList('/invoices?page=2')
      await waitForNumbers(range(13, 4))

      await user.click(screen.getByRole('button', { name: 'Total' }))

      await waitFor(() => expect(lastRequest().sortBy).toBe('totalAmount'))
      expect(lastRequest().page).toBe('1')
    })
  })

  describe('pagination', () => {
    it('fetches the next and previous pages from the server', async () => {
      const { user } = await openList()
      await waitForNumbers(range(23, 14))

      await user.click(screen.getByRole('button', { name: 'Go to next page' }))
      await waitForNumbers(range(13, 4))
      expect(lastRequest().page).toBe('2')
      expect(screen.getByText('11–20 of 23')).toBeInTheDocument()
      expect(currentUrl()).toBe('/invoices?page=2')

      await user.click(screen.getByRole('button', { name: 'Go to next page' }))
      await waitForNumbers(range(3, 1))
      expect(
        screen.getByRole('button', { name: 'Go to next page' }),
      ).toBeDisabled()

      await user.click(
        screen.getByRole('button', { name: 'Go to previous page' }),
      )
      await waitForNumbers(range(13, 4))
    })

    it('changes the page size and returns to the first page', async () => {
      const { user } = await openList('/invoices?page=2')
      await waitForNumbers(range(13, 4))

      await user.click(screen.getByRole('combobox', { name: /Rows per page/ }))
      await user.click(screen.getByRole('option', { name: '25' }))

      await waitForNumbers(range(23, 1))
      expect(lastRequest()).toMatchObject({ page: '1', pageSize: '25' })
      expect(currentUrl()).toBe('/invoices?pageSize=25')
    })

    it('offers page sizes of 10, 25 and 50', async () => {
      const { user } = await openList()
      await waitForNumbers(range(23, 14))

      await user.click(screen.getByRole('combobox', { name: /Rows per page/ }))

      expect(
        screen.getAllByRole('option').map((option) => option.textContent),
      ).toEqual(['10', '25', '50'])
    })
  })

  describe('state kept in the URL', () => {
    it('restores search, filter, sort and page from a link', async () => {
      await openList(
        '/invoices?keyword=inv&status=Overdue&sortBy=totalAmount&ordering=ASC&page=1&pageSize=25',
      )

      await waitFor(() =>
        expect(lastRequest()).toEqual({
          keyword: 'inv',
          status: 'Overdue',
          sortBy: 'totalAmount',
          ordering: 'ASC',
          page: '1',
          pageSize: '25',
        }),
      )
      expect(screen.getByLabelText('Search')).toHaveValue('inv')
      expect(
        screen.getByRole('combobox', { name: 'Status' }),
      ).toHaveTextContent('Overdue')
      await waitForNumbers([
        'INV-0004',
        'INV-0008',
        'INV-0012',
        'INV-0016',
        'INV-0020',
      ])
    })

    it('falls back to defaults for values it does not recognise', async () => {
      await openList(
        '/invoices?page=abc&pageSize=7&sortBy=password&ordering=sideways&status=Late',
      )

      await waitForNumbers(range(23, 14))
      expect(lastRequest()).toEqual({
        page: '1',
        pageSize: '10',
        sortBy: 'invoiceDate',
        ordering: 'DESC',
      })
    })
  })

  describe('when there is nothing to show', () => {
    it('says no invoices match, and can clear the filters', async () => {
      const { user } = await openList('/invoices?keyword=zzz&status=Paid')

      expect(
        await screen.findByText('No invoices match your search or filter.'),
      ).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Clear filters' }))

      await waitForNumbers(range(23, 14))
      expect(screen.getByLabelText('Search')).toHaveValue('')
      expect(currentUrl()).toBe('/invoices')
    })

    it('says there are no invoices yet when the system is empty', async () => {
      server.use(
        http.get(`${API_URL}/invoices`, () =>
          HttpResponse.json({
            data: [],
            paging: { page: 1, pageSize: 10, total: 0 },
          }),
        ),
      )
      await openList()

      expect(
        await screen.findByText('There are no invoices yet.'),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Clear filters' }),
      ).not.toBeInTheDocument()
    })

    it('offers the first page when the URL points past the last one', async () => {
      const { user } = await openList('/invoices?page=9')

      await user.click(
        await screen.findByRole('button', { name: 'Go to the first page' }),
      )

      await waitForNumbers(range(23, 14))
    })
  })

  describe('when loading fails', () => {
    it('shows the error and retries on request', async () => {
      let failing = true
      server.use(
        http.get(`${API_URL}/invoices`, ({ request }) => {
          if (!failing) return undefined // fall through to the working handler
          void request
          return HttpResponse.json(
            { statusCode: 500, message: 'Internal server error' },
            { status: 500 },
          )
        }),
      )
      const { user } = await openList()

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Could not load invoices. Internal server error',
      )
      expect(screen.queryByRole('table')).not.toBeInTheDocument()

      failing = false
      await user.click(screen.getByRole('button', { name: 'Retry' }))

      await waitForNumbers(range(23, 14))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('returns to the Login screen when the session has expired', async () => {
      server.use(
        http.get(`${API_URL}/invoices`, () =>
          HttpResponse.json(
            { statusCode: 401, message: 'Invalid or expired token' },
            { status: 401 },
          ),
        ),
      )
      await openList()

      expect(
        await screen.findByRole('heading', {
          name: 'Sign in to SimpleInvoice',
        }),
      ).toBeInTheDocument()
      expect(tokenStorage.get()).toBeNull()
    })
  })

  describe('on a phone', () => {
    beforeEach(() => setPhoneViewport(true))

    it('shows cards instead of a table', async () => {
      await openList()

      const cards = await screen.findAllByRole('listitem')
      expect(cards).toHaveLength(10)
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      expect(cards[0]).toHaveAccessibleName('Invoice INV-0023')
      expect(cards[0]).toHaveTextContent('Bob Stone')
      expect(cards[0]).toHaveTextContent('Issued 23 Jun 2026')
      expect(cards[0]).toHaveTextContent('Due 23 Jul 2026')
      expect(cards[0]).toHaveTextContent('AU$2,300.00')
      expect(cards[0]).toHaveTextContent('Paid')
    })

    it('sorts through a menu', async () => {
      const { user } = await openList()
      await screen.findAllByRole('listitem')

      await user.click(screen.getByRole('combobox', { name: 'Sort by' }))
      await user.click(
        screen.getByRole('option', { name: 'Total, lowest first' }),
      )

      await waitFor(() =>
        expect(lastRequest()).toMatchObject({
          sortBy: 'totalAmount',
          ordering: 'ASC',
          page: '1',
        }),
      )
      await waitFor(() =>
        expect(screen.getAllByRole('listitem')[0]).toHaveAccessibleName(
          'Invoice INV-0001',
        ),
      )
    })

    it('still pages through the list', async () => {
      const { user } = await openList()
      await screen.findAllByRole('listitem')

      await user.click(screen.getByRole('button', { name: 'Go to next page' }))

      await waitFor(() => expect(lastRequest().page).toBe('2'))
    })
  })

  it('has no sort menu on a wide screen, where the headers do the sorting', async () => {
    setPhoneViewport(false)
    await openList()
    await waitForNumbers(range(23, 14))

    expect(
      screen.queryByRole('combobox', { name: 'Sort by' }),
    ).not.toBeInTheDocument()
  })
})

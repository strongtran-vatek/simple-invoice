import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { tokenStorage } from '../auth/tokenStorage'
import { currentUrl, renderApp } from '../test/renderApp'
import {
  API_URL,
  invoiceCreateRequests,
  server,
  TEST_PASSWORD,
  TEST_TOKEN,
  TEST_USER,
} from '../test/server'

/** Opens the form as a signed-in user on 21 November 2026. */
async function openForm(path = '/invoices/new') {
  // Only the date is faked; timers keep running so typing still works.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 21, 10, 30))
  tokenStorage.set(TEST_TOKEN)
  const view = renderApp(path)
  await screen.findByRole('heading', { name: 'New invoice' })
  return view
}

const field = (name: string | RegExp) =>
  screen.getByRole('textbox', { name }) as HTMLInputElement
/** Date inputs have no textbox role, so they are found by label. */
const dateField = (label: string) =>
  screen.getByLabelText(new RegExp(`^${label}`)) as HTMLInputElement
const currencyField = () =>
  screen.getByRole('combobox', { name: /Currency/ }) as HTMLSelectElement
const submitButton = () => screen.getByRole('button', { name: /Creat/ })

async function retype(user: UserEvent, input: HTMLElement, text: string) {
  await user.clear(input)
  if (text !== '') {
    await user.type(input, text)
  }
}

/** Fills in the fields that have no default, with valid values. */
async function fillRequiredFields(user: UserEvent, invoiceNumber = 'INV-NEW') {
  await user.type(field(/Invoice number/), invoiceNumber)
  await user.type(field(/Customer name/), 'Dana Lee')
  await user.type(field(/Customer email/), 'dana@example.com')
  await user.type(field(/Item name/), 'Consulting')
  await user.type(field(/Rate/), '150.50')
}

describe('InvoiceCreatePage', () => {
  describe('getting to the form', () => {
    it('is opened from the New invoice button on the list', async () => {
      tokenStorage.set(TEST_TOKEN)
      const { user } = renderApp('/invoices')

      await user.click(await screen.findByRole('link', { name: 'New invoice' }))

      expect(
        await screen.findByRole('heading', { name: 'New invoice' }),
      ).toBeInTheDocument()
      expect(currentUrl()).toBe('/invoices/new')
    })

    it('sends an unauthenticated visitor to the Login screen, then back', async () => {
      const { user } = renderApp('/invoices/new')

      await user.type(
        await screen.findByLabelText('Email address'),
        TEST_USER.email,
      )
      await user.type(screen.getByLabelText('Password'), TEST_PASSWORD)
      await user.click(screen.getByRole('button', { name: 'Sign in' }))

      expect(
        await screen.findByRole('heading', { name: 'New invoice' }),
      ).toBeInTheDocument()
    })
  })

  describe('defaults', () => {
    it('starts with today, a due date 30 days on, AUD, 10% tax and no discount', async () => {
      await openForm()

      expect(dateField('Invoice date')).toHaveValue('2026-11-21')
      expect(dateField('Due date')).toHaveValue('2026-12-21')
      expect(currencyField()).toHaveValue('AUD')
      expect(field(/Tax/)).toHaveValue('10')
      expect(field(/Discount/)).toHaveValue('0')
      expect(field(/Quantity/)).toHaveValue('1')
    })

    it('offers every supported currency', async () => {
      await openForm()

      expect(
        within(currencyField())
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['AUD', 'USD', 'GBP', 'EUR', 'SGD', 'VND'])
    })

    it('marks the required fields', async () => {
      await openForm()

      for (const name of [
        /Invoice number/,
        /Customer name/,
        /Customer email/,
        /Item name/,
        /Quantity/,
        /Rate/,
        /Tax/,
      ]) {
        expect(field(name)).toBeRequired()
      }
      expect(dateField('Invoice date')).toBeRequired()
      expect(dateField('Due date')).toBeRequired()
      for (const name of [/Reference/, /Mobile/, /Address/, /Discount/]) {
        expect(field(name)).not.toBeRequired()
      }
    })
  })

  describe('the workflow: create an invoice, then see it in the list', () => {
    it('saves the invoice, confirms it and shows it on the Invoice List', async () => {
      const { user } = await openForm()

      await fillRequiredFields(user)
      await retype(user, field(/Quantity/), '4')
      await user.click(submitButton())

      // Redirected to the list, with a confirmation.
      expect(
        await screen.findByRole('heading', { name: 'Invoices' }),
      ).toBeInTheDocument()
      expect(currentUrl()).toBe('/invoices')
      expect(await screen.findByRole('status')).toHaveTextContent(
        'Invoice INV-NEW created',
      )

      // Dated today, so it is the first row; its total came from the backend:
      // 4 × 150.50 = 602.00, plus 10% tax.
      const row = await screen.findByRole('row', { name: /INV-NEW/ })
      expect(
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      ).toEqual([
        'INV-NEW',
        'Dana Lee',
        '21 Nov 2026',
        '21 Dec 2026',
        'AU$662.20',
        'Draft',
      ])
      expect(screen.getByText('24 invoices')).toBeInTheDocument()
    })

    it('sends exactly what was typed, and no totals', async () => {
      const { user } = await openForm()

      await user.type(field(/Invoice number/), '  INV-FULL  ')
      await user.type(field(/Reference/), 'PO-9')
      await retype(user, dateField('Invoice date'), '2026-06-03')
      await retype(user, dateField('Due date'), '2026-07-03')
      await user.selectOptions(currencyField(), 'GBP')
      await user.type(field(/Description/), 'June services')
      await user.type(field(/Customer name/), 'Paul')
      await user.type(field(/Customer email/), 'paul@101digital.io')
      await user.type(field(/Mobile/), '947717364111')
      await user.type(field(/Address/), 'Singapore')
      await user.type(field(/Item name/), 'Honda RC150')
      await retype(user, field(/Quantity/), '2')
      await user.type(field(/Rate/), '1000')
      await retype(user, field(/Tax/), '7.5')
      await retype(user, field(/Discount/), '20')
      await user.click(submitButton())

      await waitFor(() => expect(invoiceCreateRequests).toHaveLength(1))
      expect(invoiceCreateRequests[0]).toEqual({
        invoiceNumber: 'INV-FULL',
        invoiceReference: 'PO-9',
        invoiceDate: '2026-06-03',
        dueDate: '2026-07-03',
        currency: 'GBP',
        description: 'June services',
        customer: {
          fullname: 'Paul',
          email: 'paul@101digital.io',
          mobileNumber: '947717364111',
          address: 'Singapore',
        },
        items: [{ name: 'Honda RC150', quantity: 2, rate: 1000 }],
        tax: 7.5,
        discount: 20,
      })
    })

    it('leaves blank optional fields out, and sends an empty discount as 0', async () => {
      const { user } = await openForm()

      await fillRequiredFields(user)
      await user.clear(field(/Discount/))
      await user.click(submitButton())

      await waitFor(() => expect(invoiceCreateRequests).toHaveLength(1))
      expect(invoiceCreateRequests[0]).toEqual({
        invoiceNumber: 'INV-NEW',
        invoiceDate: '2026-11-21',
        dueDate: '2026-12-21',
        currency: 'AUD',
        customer: { fullname: 'Dana Lee', email: 'dana@example.com' },
        items: [{ name: 'Consulting', quantity: 1, rate: 150.5 }],
        tax: 10,
        discount: 0,
      })
    })

    it('links the confirmation to the new invoice', async () => {
      const { user } = await openForm()

      await fillRequiredFields(user)
      await user.click(submitButton())
      await user.click(await screen.findByRole('link', { name: 'View' }))

      expect(
        await screen.findByRole('heading', { name: 'Invoice INV-NEW' }),
      ).toBeInTheDocument()
      // The confirmation is dismissed once it has been used.
      await waitFor(() =>
        expect(screen.queryByRole('status')).not.toBeInTheDocument(),
      )
    })

    it('lets the confirmation be dismissed', async () => {
      const { user } = await openForm()

      await fillRequiredFields(user)
      await user.click(submitButton())
      await user.click(await screen.findByRole('button', { name: 'Dismiss' }))

      await waitFor(() =>
        expect(screen.queryByRole('status')).not.toBeInTheDocument(),
      )
    })
  })

  describe('validation before sending', () => {
    it('names every required field left empty, and sends nothing', async () => {
      const { user } = await openForm()

      await user.clear(dateField('Invoice date'))
      await user.clear(dateField('Due date'))
      await user.clear(field(/Quantity/))
      await user.clear(field(/Tax/))
      await user.click(submitButton())

      for (const message of [
        'Invoice number is required',
        'Invoice date is required',
        'Due date is required',
        'Customer name is required',
        'Customer email is required',
        'Item name is required',
        'Quantity is required',
        'Rate is required',
        'Enter a tax rate, or 0 for no tax',
      ]) {
        expect(await screen.findByText(message)).toBeInTheDocument()
      }
      expect(invoiceCreateRequests).toHaveLength(0)
      expect(currentUrl()).toBe('/invoices/new')
    })

    it('marks an invalid field and moves focus to the first one', async () => {
      const { user } = await openForm()

      await user.click(submitButton())

      await screen.findByText('Invoice number is required')
      expect(field(/Invoice number/)).toBeInvalid()
      expect(field(/Invoice number/)).toHaveAccessibleDescription(
        'Invoice number is required',
      )
      expect(field(/Invoice number/)).toHaveFocus()
    })

    it.each([
      [/Customer email/, 'dana-at-example', 'Enter a valid email address'],
      [/Quantity/, '1.5', 'Quantity must be a whole number of 1 or more'],
      [/Quantity/, '0', 'Quantity must be a whole number of 1 or more'],
      [
        /Rate/,
        '0',
        'Rate must be a number greater than 0, with up to 2 decimal places',
      ],
      [
        /Rate/,
        '9.999',
        'Rate must be a number greater than 0, with up to 2 decimal places',
      ],
      [
        /Tax/,
        '-5',
        'Tax must be a number of 0 or more, with up to 2 decimal places',
      ],
      [/Tax/, '101', 'Tax must be at most 100'],
      [
        /Discount/,
        '-1',
        'Discount must be a number of 0 or more, with up to 2 decimal places',
      ],
    ])('rejects %s of "%s"', async (name, value, message) => {
      const { user } = await openForm()

      await fillRequiredFields(user)
      await retype(user, field(name), value)
      await user.click(submitButton())

      expect(await screen.findByText(message)).toBeInTheDocument()
      expect(field(name)).toBeInvalid()
      expect(invoiceCreateRequests).toHaveLength(0)
    })

    it('rejects a due date before the invoice date', async () => {
      const { user } = await openForm()

      await fillRequiredFields(user)
      await retype(user, dateField('Due date'), '2026-11-20')
      await user.click(submitButton())

      expect(
        await screen.findByText(
          'Due date must be on or after the invoice date',
        ),
      ).toBeInTheDocument()
      expect(dateField('Due date')).toBeInvalid()
      expect(invoiceCreateRequests).toHaveLength(0)
    })

    it('accepts a due date on the invoice date', async () => {
      const { user } = await openForm()

      await fillRequiredFields(user)
      await retype(user, dateField('Due date'), '2026-11-21')
      await user.click(submitButton())

      await waitFor(() => expect(invoiceCreateRequests).toHaveLength(1))
    })

    it('clears the due date error when the invoice date is moved back', async () => {
      const { user } = await openForm()

      await fillRequiredFields(user)
      await retype(user, dateField('Due date'), '2026-11-20')
      await user.click(submitButton())
      await screen.findByText('Due date must be on or after the invoice date')

      await retype(user, dateField('Invoice date'), '2026-11-01')

      await waitFor(() =>
        expect(
          screen.queryByText('Due date must be on or after the invoice date'),
        ).not.toBeInTheDocument(),
      )
    })

    it('clears a message as soon as its field is corrected', async () => {
      const { user } = await openForm()

      await user.click(submitButton())
      await screen.findByText('Customer name is required')

      await user.type(field(/Customer name/), 'Dana Lee')

      await waitFor(() =>
        expect(
          screen.queryByText('Customer name is required'),
        ).not.toBeInTheDocument(),
      )
      expect(screen.getByText('Item name is required')).toBeInTheDocument()
    })
  })

  describe('when the backend refuses the invoice', () => {
    it('shows a taken invoice number on its field, and keeps what was typed', async () => {
      const { user } = await openForm()

      // INV-0005 exists; the comparison ignores case.
      await fillRequiredFields(user, 'inv-0005')
      await user.click(submitButton())

      expect(
        await screen.findByText(
          'An invoice with this invoice number already exists',
        ),
      ).toBeInTheDocument()
      expect(field(/Invoice number/)).toBeInvalid()
      expect(field(/Invoice number/)).toHaveFocus()
      expect(field(/Invoice number/)).toHaveAccessibleDescription(
        'An invoice with this invoice number already exists',
      )
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(currentUrl()).toBe('/invoices/new')
      expect(field(/Customer name/)).toHaveValue('Dana Lee')
      expect(field(/Rate/)).toHaveValue('150.50')
    })

    it('succeeds once the number is changed', async () => {
      const { user } = await openForm()

      await fillRequiredFields(user, 'INV-0005')
      await user.click(submitButton())
      await screen.findByText(
        'An invoice with this invoice number already exists',
      )

      await retype(user, field(/Invoice number/), 'INV-0005-B')
      await user.click(submitButton())

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Invoice INV-0005-B created',
      )
      expect(currentUrl()).toBe('/invoices')
    })

    it('lists other validation messages from the backend above the form', async () => {
      server.use(
        http.post(`${API_URL}/invoices`, () =>
          HttpResponse.json(
            {
              statusCode: 400,
              message: [
                'discount must not exceed the subtotal plus tax',
                'customer.email must be a valid email address',
              ],
              error: 'Bad Request',
            },
            { status: 400 },
          ),
        ),
      )
      const { user } = await openForm()

      await fillRequiredFields(user)
      await user.click(submitButton())

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('The invoice was not created.')
      expect(
        within(alert)
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual([
        'discount must not exceed the subtotal plus tax',
        'customer.email must be a valid email address',
      ])
      expect(currentUrl()).toBe('/invoices/new')
      expect(submitButton()).toBeEnabled()
    })

    it('says so when the server cannot be reached, and can be retried', async () => {
      server.use(
        http.post(`${API_URL}/invoices`, () => HttpResponse.error(), {
          once: true,
        }),
      )
      const { user } = await openForm()

      await fillRequiredFields(user)
      await user.click(submitButton())
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Cannot reach the server',
      )

      await user.click(submitButton())

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Invoice INV-NEW created',
      )
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('returns to the Login screen when the session has expired', async () => {
      server.use(
        http.post(`${API_URL}/invoices`, () =>
          HttpResponse.json(
            {
              statusCode: 401,
              message: 'Invalid or expired token',
              error: 'Unauthorized',
            },
            { status: 401 },
          ),
        ),
      )
      const { user } = await openForm()

      await fillRequiredFields(user)
      await user.click(submitButton())

      expect(
        await screen.findByRole('heading', {
          name: 'Sign in to SimpleInvoice',
        }),
      ).toBeInTheDocument()
      expect(tokenStorage.get()).toBeNull()
    })
  })

  describe('while the invoice is being saved', () => {
    it('disables the buttons so it cannot be sent twice', async () => {
      let release = () => {}
      const held = new Promise<void>((resolve) => {
        release = resolve
      })
      server.use(
        http.post(
          `${API_URL}/invoices`,
          async () => {
            await held
            await delay(0)
            return HttpResponse.json(
              { statusCode: 500, message: 'Internal server error', error: '' },
              { status: 500 },
            )
          },
          { once: true },
        ),
      )
      const { user } = await openForm()

      await fillRequiredFields(user)
      await user.click(submitButton())

      const saving = await screen.findByRole('button', { name: 'Creating…' })
      expect(saving).toBeDisabled()
      expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
        'aria-disabled',
        'true',
      )

      release()

      expect(
        await screen.findByRole('button', { name: 'Create invoice' }),
      ).toBeEnabled()
    })
  })

  describe('leaving without saving', () => {
    it('Cancel returns to the list as it was, without creating anything', async () => {
      tokenStorage.set(TEST_TOKEN)
      const { user } = renderApp('/invoices?status=Paid&page=2')

      await user.click(await screen.findByRole('link', { name: 'New invoice' }))
      await user.type(
        await screen.findByRole('textbox', { name: /Invoice number/ }),
        'X',
      )
      await user.click(screen.getByRole('link', { name: 'Cancel' }))

      await screen.findByRole('heading', { name: 'Invoices' })
      expect(currentUrl()).toBe('/invoices?status=Paid&page=2')
      expect(invoiceCreateRequests).toHaveLength(0)
    })

    it('Back to invoices leads to the default list when opened directly', async () => {
      const { user } = await openForm()

      await user.click(screen.getByRole('link', { name: 'Back to invoices' }))

      await screen.findByRole('heading', { name: 'Invoices' })
      expect(currentUrl()).toBe('/invoices')
    })
  })
})

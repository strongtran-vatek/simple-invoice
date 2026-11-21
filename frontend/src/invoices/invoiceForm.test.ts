import {
  defaultInvoiceForm,
  type InvoiceFormValues,
  invoiceFormSchema,
  toCreateInvoiceRequest,
} from './invoiceForm'

/** A form with every field filled in correctly. */
const VALID: InvoiceFormValues = {
  invoiceNumber: 'INV-1001',
  invoiceReference: 'PO-77',
  invoiceDate: '2026-06-03',
  dueDate: '2026-07-03',
  currency: 'AUD',
  description: 'June services',
  customerName: 'Paul',
  customerEmail: 'paul@101digital.io',
  customerMobile: '947717364111',
  customerAddress: 'Singapore',
  itemName: 'Honda RC150',
  quantity: '2',
  rate: '1000',
  tax: '10',
  discount: '20',
}

/** The message shown under each invalid field. */
function errorsFor(changes: Partial<InvoiceFormValues>) {
  const result = invoiceFormSchema.safeParse({ ...VALID, ...changes })
  if (result.success) {
    return {}
  }
  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    // The form shows the first message for a field, as this does.
    errors[String(issue.path[0])] ??= issue.message
  }
  return errors
}

describe('invoiceFormSchema', () => {
  it('accepts a complete form', () => {
    expect(errorsFor({})).toEqual({})
  })

  it('accepts a form with the optional fields left blank', () => {
    expect(
      errorsFor({
        invoiceReference: '',
        description: '',
        customerMobile: '',
        customerAddress: '',
        discount: '',
      }),
    ).toEqual({})
  })

  it('names every required field that is empty', () => {
    expect(
      errorsFor({
        invoiceNumber: '',
        invoiceDate: '',
        dueDate: '',
        customerName: '  ',
        customerEmail: '',
        itemName: '',
        quantity: '',
        rate: '',
        tax: '',
      }),
    ).toEqual({
      invoiceNumber: 'Invoice number is required',
      invoiceDate: 'Invoice date is required',
      dueDate: 'Due date is required',
      customerName: 'Customer name is required',
      customerEmail: 'Customer email is required',
      itemName: 'Item name is required',
      quantity: 'Quantity is required',
      rate: 'Rate is required',
      tax: 'Enter a tax rate, or 0 for no tax',
    })
  })

  describe('customer email', () => {
    it.each(['paul', 'paul@', '@example.com', 'paul example@x.io'])(
      'rejects %s',
      (customerEmail) => {
        expect(errorsFor({ customerEmail })).toEqual({
          customerEmail: 'Enter a valid email address',
        })
      },
    )

    it('ignores surrounding spaces', () => {
      expect(errorsFor({ customerEmail: '  paul@101digital.io ' })).toEqual({})
    })
  })

  describe('dates', () => {
    it('rejects a due date before the invoice date', () => {
      expect(
        errorsFor({ invoiceDate: '2026-06-03', dueDate: '2026-06-02' }),
      ).toEqual({ dueDate: 'Due date must be on or after the invoice date' })
    })

    it('accepts a due date equal to the invoice date', () => {
      expect(
        errorsFor({ invoiceDate: '2026-06-03', dueDate: '2026-06-03' }),
      ).toEqual({})
    })

    it('rejects a date that does not exist', () => {
      expect(errorsFor({ invoiceDate: '2026-02-30' })).toEqual({
        invoiceDate: 'Enter a valid date',
      })
    })

    it('rejects a year with more than four digits', () => {
      expect(errorsFor({ dueDate: '202606-07-03' })).toEqual({
        dueDate: 'Enter a valid date',
      })
    })
  })

  describe('quantity', () => {
    const message = 'Quantity must be a whole number of 1 or more'

    it.each(['0', '1.5', '-2', 'two', '1e3', '2 units'])(
      'rejects %s',
      (quantity) => {
        expect(errorsFor({ quantity })).toEqual({ quantity: message })
      },
    )

    it('rejects a quantity above the limit', () => {
      expect(errorsFor({ quantity: '1000001' })).toEqual({
        quantity: 'Quantity must be at most 1000000',
      })
    })

    it.each(['1', ' 25 ', '1000000'])('accepts %s', (quantity) => {
      expect(errorsFor({ quantity })).toEqual({})
    })
  })

  describe('rate', () => {
    const message =
      'Rate must be a number greater than 0, with up to 2 decimal places'

    it.each(['0', '0.00', '-5', '9.999', 'abc', '1,000', '12abc'])(
      'rejects %s',
      (rate) => {
        expect(errorsFor({ rate })).toEqual({ rate: message })
      },
    )

    it.each(['0.01', '19.99', '1000', '5.5'])('accepts %s', (rate) => {
      expect(errorsFor({ rate })).toEqual({})
    })
  })

  describe('tax', () => {
    const message =
      'Tax must be a number of 0 or more, with up to 2 decimal places'

    it.each(['-1', '7.125', 'ten'])('rejects %s', (tax) => {
      expect(errorsFor({ tax })).toEqual({ tax: message })
    })

    it('rejects a tax above 100%', () => {
      expect(errorsFor({ tax: '100.01' })).toEqual({
        tax: 'Tax must be at most 100',
      })
    })

    it.each(['0', '7.5', '100'])('accepts %s', (tax) => {
      expect(errorsFor({ tax })).toEqual({})
    })
  })

  describe('discount', () => {
    it.each(['-1', '5.555', 'none'])('rejects %s', (discount) => {
      expect(errorsFor({ discount })).toEqual({
        discount:
          'Discount must be a number of 0 or more, with up to 2 decimal places',
      })
    })

    it('treats an empty discount as none', () => {
      const form = invoiceFormSchema.parse({ ...VALID, discount: '  ' })

      expect(form.discount).toBe(0)
    })
  })

  describe('length limits', () => {
    it.each([
      ['invoiceNumber', 50, 'Invoice number'],
      ['invoiceReference', 50, 'Reference'],
      ['description', 500, 'Description'],
      ['customerName', 255, 'Customer name'],
      ['customerMobile', 50, 'Mobile'],
      ['customerAddress', 500, 'Address'],
      ['itemName', 255, 'Item name'],
    ] as const)('limits %s to %i characters', (name, limit, label) => {
      expect(errorsFor({ [name]: 'x'.repeat(limit) })).toEqual({})
      expect(errorsFor({ [name]: 'x'.repeat(limit + 1) })).toEqual({
        [name]: `${label} must be at most ${limit} characters`,
      })
    })
  })

  it('reports a wrong due date alongside other mistakes', () => {
    expect(
      errorsFor({
        invoiceNumber: '',
        invoiceDate: '2026-06-03',
        dueDate: '2026-06-01',
      }),
    ).toEqual({
      invoiceNumber: 'Invoice number is required',
      dueDate: 'Due date must be on or after the invoice date',
    })
  })
})

describe('defaultInvoiceForm', () => {
  it('starts with today, a due date 30 days on, AUD, 10% tax and no discount', () => {
    expect(defaultInvoiceForm('2026-11-21')).toEqual({
      invoiceNumber: '',
      invoiceReference: '',
      invoiceDate: '2026-11-21',
      dueDate: '2026-12-21',
      currency: 'AUD',
      description: '',
      customerName: '',
      customerEmail: '',
      customerMobile: '',
      customerAddress: '',
      itemName: '',
      quantity: '1',
      rate: '',
      tax: '10',
      discount: '0',
    })
  })
})

describe('toCreateInvoiceRequest', () => {
  it('nests the customer and the single line item, with real numbers', () => {
    expect(toCreateInvoiceRequest(invoiceFormSchema.parse(VALID))).toEqual({
      invoiceNumber: 'INV-1001',
      invoiceReference: 'PO-77',
      invoiceDate: '2026-06-03',
      dueDate: '2026-07-03',
      currency: 'AUD',
      description: 'June services',
      customer: {
        fullname: 'Paul',
        email: 'paul@101digital.io',
        mobileNumber: '947717364111',
        address: 'Singapore',
      },
      items: [{ name: 'Honda RC150', quantity: 2, rate: 1000 }],
      tax: 10,
      discount: 20,
    })
  })

  it('trims text and leaves blank optional fields out', () => {
    const request = toCreateInvoiceRequest(
      invoiceFormSchema.parse({
        ...VALID,
        invoiceNumber: '  INV-1001  ',
        customerName: ' Paul ',
        invoiceReference: '   ',
        description: '',
        customerMobile: '',
        customerAddress: ' ',
      }),
    )

    expect(request.invoiceNumber).toBe('INV-1001')
    expect(request.customer.fullname).toBe('Paul')
    expect(request.invoiceReference).toBeUndefined()
    expect(request.description).toBeUndefined()
    expect(request.customer.mobileNumber).toBeUndefined()
    expect(request.customer.address).toBeUndefined()
  })

  it('never sends a status, a total or a currency symbol', () => {
    const request = toCreateInvoiceRequest(invoiceFormSchema.parse(VALID))

    expect(Object.keys(request).sort()).toEqual([
      'currency',
      'customer',
      'description',
      'discount',
      'dueDate',
      'invoiceDate',
      'invoiceNumber',
      'invoiceReference',
      'items',
      'tax',
    ])
  })
})

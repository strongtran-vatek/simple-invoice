import { plainToInstance } from 'class-transformer';
import { validateSync, type ValidationError } from 'class-validator';
import { CreateInvoiceDto } from './create-invoice.dto.js';

/** A request with every field filled in correctly. */
const VALID = {
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
};

type Body = Record<string, unknown>;

const withCustomer = (changes: Body): Body => ({
  ...VALID,
  customer: { ...VALID.customer, ...changes },
});

const withItem = (changes: Body): Body => ({
  ...VALID,
  items: [{ ...VALID.items[0], ...changes }],
});

const parse = (body: Body) => plainToInstance(CreateInvoiceDto, body);

/** Every message, with nested ones prefixed by their path, as the API reports them. */
function messagesOf(errors: ValidationError[], path = ''): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}).map(
      (message) => `${path}${message}`,
    ),
    ...messagesOf(error.children ?? [], `${path}${error.property}.`),
  ]);
}

const messagesFor = (body: Body) =>
  messagesOf(
    validateSync(parse(body), { whitelist: true, forbidNonWhitelisted: true }),
  );

describe('CreateInvoiceDto', () => {
  it('accepts a complete request', () => {
    expect(messagesFor(VALID)).toEqual([]);
  });

  it('accepts a request with only the required fields', () => {
    expect(
      messagesFor({
        invoiceNumber: 'INV-1001',
        invoiceDate: '2026-06-03',
        dueDate: '2026-06-03',
        currency: 'USD',
        customer: { fullname: 'Paul', email: 'paul@101digital.io' },
        items: [{ name: 'Honda RC150', quantity: 1, rate: 0.01 }],
      }),
    ).toEqual([]);
  });

  describe('required fields', () => {
    it.each([
      ['invoiceNumber', 'invoiceNumber must not be empty'],
      ['invoiceDate', 'invoiceDate must be a valid date in YYYY-MM-DD format'],
      ['dueDate', 'dueDate must be a valid date in YYYY-MM-DD format'],
      ['currency', 'currency must be one of: AUD, USD, GBP, EUR, SGD, VND'],
      ['customer', 'customer must be an object'],
      ['items', 'items must contain exactly one item'],
    ])('rejects a request without %s', (field, message) => {
      const { [field]: _omitted, ...body } = VALID as Body;

      expect(messagesFor(body)).toContain(message);
    });

    it.each([
      [
        withCustomer({ fullname: undefined }),
        'customer.fullname must not be empty',
      ],
      [
        withCustomer({ fullname: '   ' }),
        'customer.fullname must not be empty',
      ],
      [
        withCustomer({ email: undefined }),
        'customer.email must be a valid email address',
      ],
      [withItem({ name: '  ' }), 'items.0.name must not be empty'],
      [
        withItem({ quantity: undefined }),
        'items.0.quantity must be a whole number',
      ],
      [
        withItem({ rate: undefined }),
        'items.0.rate must be a number with at most 2 decimal places',
      ],
      [{ ...VALID, invoiceNumber: '   ' }, 'invoiceNumber must not be empty'],
    ])('rejects a missing or blank nested value (case %#)', (body, message) => {
      expect(messagesFor(body)).toContain(message);
    });
  });

  describe('optional fields', () => {
    it('treats blank optional text as absent', () => {
      const dto = parse({
        ...withCustomer({ mobileNumber: '  ', address: '' }),
        invoiceReference: ' ',
        description: '',
      });

      expect(validateSync(dto)).toEqual([]);
      expect(dto.invoiceReference).toBeUndefined();
      expect(dto.description).toBeUndefined();
      expect(dto.customer.mobileNumber).toBeUndefined();
      expect(dto.customer.address).toBeUndefined();
    });

    it('leaves tax and discount unset when they are not sent', () => {
      const { tax: _tax, discount: _discount, ...body } = VALID;
      const dto = parse(body);

      expect(validateSync(dto)).toEqual([]);
      expect(dto.tax).toBeUndefined();
      expect(dto.discount).toBeUndefined();
    });
  });

  describe('normalisation', () => {
    it('trims text and upper-cases the currency', () => {
      const dto = parse({
        ...withCustomer({
          fullname: '  Paul  ',
          email: ' paul@101digital.io ',
        }),
        invoiceNumber: '  INV-1001  ',
        currency: 'aud',
        items: [{ name: '  Honda RC150 ', quantity: 2, rate: 1000 }],
      });

      expect(validateSync(dto)).toEqual([]);
      expect(dto.invoiceNumber).toBe('INV-1001');
      expect(dto.currency).toBe('AUD');
      expect(dto.customer.fullname).toBe('Paul');
      expect(dto.customer.email).toBe('paul@101digital.io');
      expect(dto.items[0].name).toBe('Honda RC150');
    });
  });

  describe('field rules', () => {
    it.each([
      [
        'an invalid customer email',
        withCustomer({ email: 'paul-at-example' }),
        'customer.email must be a valid email address',
      ],
      [
        'a due date before the invoice date',
        { ...VALID, invoiceDate: '2026-06-03', dueDate: '2026-06-02' },
        'dueDate must be on or after invoiceDate',
      ],
      [
        'an invoice date that does not exist',
        { ...VALID, invoiceDate: '2026-02-30' },
        'invoiceDate must be a valid date in YYYY-MM-DD format',
      ],
      [
        'an unsupported currency',
        { ...VALID, currency: 'JPY' },
        'currency must be one of: AUD, USD, GBP, EUR, SGD, VND',
      ],
      [
        'a quantity of zero',
        withItem({ quantity: 0 }),
        'items.0.quantity must not be less than 1',
      ],
      [
        'a fractional quantity',
        withItem({ quantity: 1.5 }),
        'items.0.quantity must be a whole number',
      ],
      [
        'a quantity sent as text',
        withItem({ quantity: '2' }),
        'items.0.quantity must be a whole number',
      ],
      [
        'a rate of zero',
        withItem({ rate: 0 }),
        'items.0.rate must be greater than 0',
      ],
      [
        'a negative rate',
        withItem({ rate: -5 }),
        'items.0.rate must be greater than 0',
      ],
      [
        'a rate with three decimal places',
        withItem({ rate: 9.999 }),
        'items.0.rate must be a number with at most 2 decimal places',
      ],
      ['a negative tax', { ...VALID, tax: -1 }, 'tax must not be less than 0'],
      [
        'a tax above 100%',
        { ...VALID, tax: 100.01 },
        'tax must not be greater than 100',
      ],
      [
        'a tax with three decimal places',
        { ...VALID, tax: 7.125 },
        'tax must be a number with at most 2 decimal places',
      ],
      [
        'a negative discount',
        { ...VALID, discount: -0.01 },
        'discount must not be less than 0',
      ],
      [
        'a discount sent as text',
        { ...VALID, discount: '20' },
        'discount must be a number with at most 2 decimal places',
      ],
      [
        'no items',
        { ...VALID, items: [] },
        'items must contain exactly one item',
      ],
      [
        'two items',
        { ...VALID, items: [VALID.items[0], VALID.items[0]] },
        'items must contain exactly one item',
      ],
    ])('rejects %s', (_description, body, message) => {
      expect(messagesFor(body)).toContain(message);
    });

    it('accepts a due date equal to the invoice date', () => {
      expect(
        messagesFor({
          ...VALID,
          invoiceDate: '2026-06-03',
          dueDate: '2026-06-03',
        }),
      ).toEqual([]);
    });

    it('accepts a tax of zero and a tax of 100', () => {
      expect(messagesFor({ ...VALID, tax: 0 })).toEqual([]);
      expect(messagesFor({ ...VALID, tax: 100 })).toEqual([]);
    });
  });

  describe('length limits', () => {
    it.each([
      ['invoiceNumber', { ...VALID, invoiceNumber: 'N'.repeat(51) }, 50],
      ['invoiceReference', { ...VALID, invoiceReference: 'R'.repeat(51) }, 50],
      ['description', { ...VALID, description: 'D'.repeat(501) }, 500],
      ['customer.fullname', withCustomer({ fullname: 'F'.repeat(256) }), 255],
      [
        'customer.email',
        withCustomer({ email: `${'e'.repeat(250)}@example.com` }),
        255,
      ],
      [
        'customer.mobileNumber',
        withCustomer({ mobileNumber: '9'.repeat(51) }),
        50,
      ],
      ['customer.address', withCustomer({ address: 'A'.repeat(501) }), 500],
      ['items.0.name', withItem({ name: 'I'.repeat(256) }), 255],
    ])('rejects %s longer than its limit', (path, body, limit) => {
      expect(messagesFor(body)).toContain(
        `${path} must be shorter than or equal to ${limit} characters`,
      );
    });

    it('accepts text exactly at its limit', () => {
      expect(
        messagesFor({
          ...withCustomer({
            fullname: 'F'.repeat(255),
            address: 'A'.repeat(500),
          }),
          invoiceNumber: 'N'.repeat(50),
          description: 'D'.repeat(500),
        }),
      ).toEqual([]);
    });
  });

  it('rejects fields the client may not set', () => {
    const messages = messagesFor({
      ...VALID,
      status: 'Paid',
      totalAmount: 1,
      currencySymbol: '$',
    });

    expect(messages).toEqual(
      expect.arrayContaining([
        'property status should not exist',
        'property totalAmount should not exist',
        'property currencySymbol should not exist',
      ]),
    );
  });

  it('reports one message, not several, for each simple mistake', () => {
    expect(messagesFor({ ...VALID, items: [] })).toHaveLength(1);
    expect(
      messagesFor({
        ...VALID,
        invoiceDate: '2026-06-03',
        dueDate: '2026-06-01',
      }),
    ).toHaveLength(1);
    expect(messagesFor(withCustomer({ email: 'nope' }))).toHaveLength(1);
  });
});

import { calculateInvoiceAmounts } from './invoice-calculator.js';

describe('calculateInvoiceAmounts', () => {
  it('reproduces the example in Appendix A of the specification', () => {
    const amounts = calculateInvoiceAmounts({
      quantity: 2,
      rate: 1000,
      taxRate: 10,
      discount: 20,
      totalPaid: 1451.34,
    });

    expect(amounts).toEqual({
      subTotal: '2000.00',
      taxAmount: '200.00',
      discount: '20.00',
      totalAmount: '2180.00',
      totalPaid: '1451.34',
      balanceAmount: '728.66',
    });
  });

  it('multiplies quantity by rate for the subtotal', () => {
    expect(
      calculateInvoiceAmounts({ quantity: 3, rate: '19.99', taxRate: 0 })
        .subTotal,
    ).toBe('59.97');
  });

  it('charges tax on the undiscounted subtotal', () => {
    const amounts = calculateInvoiceAmounts({
      quantity: 1,
      rate: 100,
      taxRate: 10,
      discount: 50,
    });

    // 10% of 100, not 10% of the discounted 50.
    expect(amounts.taxAmount).toBe('10.00');
    expect(amounts.totalAmount).toBe('60.00');
  });

  it('treats the discount as an amount, not a percentage', () => {
    const amounts = calculateInvoiceAmounts({
      quantity: 1,
      rate: 200,
      taxRate: 0,
      discount: 10,
    });

    expect(amounts.totalAmount).toBe('190.00');
  });

  it('defaults discount and amount paid to zero', () => {
    const amounts = calculateInvoiceAmounts({
      quantity: 1,
      rate: 100,
      taxRate: 10,
    });

    expect(amounts.discount).toBe('0.00');
    expect(amounts.totalPaid).toBe('0.00');
    expect(amounts.balanceAmount).toBe(amounts.totalAmount);
  });

  it('handles a zero tax rate', () => {
    const amounts = calculateInvoiceAmounts({
      quantity: 4,
      rate: 25,
      taxRate: 0,
    });

    expect(amounts.taxAmount).toBe('0.00');
    expect(amounts.totalAmount).toBe('100.00');
  });

  it('rounds tax half-up to the cent', () => {
    // 10.05 × 10% = 1.005, which rounds up to 1.01.
    expect(
      calculateInvoiceAmounts({ quantity: 1, rate: '10.05', taxRate: 10 })
        .taxAmount,
    ).toBe('1.01');
    // 10.04 × 10% = 1.004, which rounds down to 1.00.
    expect(
      calculateInvoiceAmounts({ quantity: 1, rate: '10.04', taxRate: 10 })
        .taxAmount,
    ).toBe('1.00');
  });

  it('supports fractional tax rates', () => {
    // 200 × 8.25% = 16.50
    expect(
      calculateInvoiceAmounts({ quantity: 2, rate: 100, taxRate: '8.25' })
        .taxAmount,
    ).toBe('16.50');
  });

  it('does not suffer from binary floating-point error', () => {
    // In floats 0.1 × 3 is 0.30000000000000004 and 1.1 × 3 is 3.3000000000000003.
    const amounts = calculateInvoiceAmounts({
      quantity: 3,
      rate: 1.1,
      taxRate: 0,
      discount: 0.1,
      totalPaid: 0.2,
    });

    expect(amounts.subTotal).toBe('3.30');
    expect(amounts.totalAmount).toBe('3.20');
    expect(amounts.balanceAmount).toBe('3.00');
  });

  it('derives the total from the rounded tax, so the parts always add up', () => {
    const amounts = calculateInvoiceAmounts({
      quantity: 7,
      rate: '33.33',
      taxRate: '7.5',
      discount: '4.99',
    });

    // subtotal 233.31, tax 17.49825 → 17.50, total 233.31 + 17.50 − 4.99
    expect(amounts).toMatchObject({
      subTotal: '233.31',
      taxAmount: '17.50',
      totalAmount: '245.82',
    });
  });

  it('subtracts the amount paid for the balance', () => {
    const amounts = calculateInvoiceAmounts({
      quantity: 1,
      rate: 100,
      taxRate: 10,
      totalPaid: 110,
    });

    expect(amounts.balanceAmount).toBe('0.00');
  });

  it('reports a negative total when the discount exceeds subtotal plus tax', () => {
    const amounts = calculateInvoiceAmounts({
      quantity: 1,
      rate: 10,
      taxRate: 10,
      discount: 50,
    });

    expect(amounts.totalAmount).toBe('-39.00');
  });

  it('keeps large amounts exact', () => {
    const amounts = calculateInvoiceAmounts({
      quantity: 1000,
      rate: '999999.99',
      taxRate: 10,
    });

    expect(amounts.subTotal).toBe('999999990.00');
    expect(amounts.totalAmount).toBe('1099999989.00');
  });
});

import { estimateInvoiceAmounts } from './estimate'

const estimate = (
  quantity: string,
  rate: string,
  tax: string,
  discount = '0',
) => estimateInvoiceAmounts({ quantity, rate, tax, discount })

/** These cases are the backend calculator's own, so the two cannot drift apart unnoticed. */
describe('estimateInvoiceAmounts', () => {
  it('reproduces the example in Appendix A of the specification', () => {
    expect(estimate('2', '1000', '10', '20')).toEqual({
      subTotal: 2000,
      tax: 200,
      discount: 20,
      total: 2180,
    })
  })

  it('multiplies quantity by rate for the subtotal', () => {
    expect(estimate('3', '19.99', '0')?.subTotal).toBe(59.97)
  })

  it('charges tax on the subtotal before the discount', () => {
    expect(estimate('1', '100', '10', '50')).toMatchObject({
      tax: 10,
      total: 60,
    })
  })

  it.each([
    // 59.97 × 7.5% = 4.49775
    ['3', '19.99', '7.5', 4.5],
    // 0.50 × 1% = 0.005, exactly half a cent
    ['1', '0.50', '1', 0.01],
    // 0.10 × 4% = 0.004
    ['1', '0.10', '4', 0],
    // 33.33 × 12.25% = 4.082925
    ['1', '33.33', '12.25', 4.08],
  ])(
    'rounds tax half-up to the cent: %s × %s at %s%%',
    (quantity, rate, tax, expected) => {
      expect(estimate(quantity, rate, tax)?.tax).toBe(expected)
    },
  )

  it('is free of floating-point error', () => {
    // 0.1 + 0.2 style sums go wrong in binary floating point.
    expect(estimate('3', '0.1', '0')?.subTotal).toBe(0.3)
    expect(estimate('1', '0.1', '0', '0.3')?.total).toBe(-0.2)
  })

  it('treats an empty discount as none', () => {
    expect(estimate('1', '100', '10', '')).toMatchObject({
      discount: 0,
      total: 110,
    })
  })

  it('reports a negative total when the discount is too large', () => {
    expect(estimate('1', '100', '10', '110.01')?.total).toBe(-0.01)
  })

  it('allows a tax of zero', () => {
    expect(estimate('2', '50', '0')).toMatchObject({ tax: 0, total: 100 })
  })

  it('ignores surrounding spaces', () => {
    expect(estimate(' 2 ', ' 50 ', ' 10 ', ' 5 ')?.total).toBe(105)
  })

  it('handles the largest amounts the backend accepts', () => {
    expect(estimate('999', '500500500.50', '100')).toEqual({
      subTotal: 499_999_999_999.5,
      tax: 499_999_999_999.5,
      discount: 0,
      total: 999_999_999_999,
    })
  })

  it.each([
    ['no rate yet', '1', '', '10', '0'],
    ['no quantity', '', '100', '10', '0'],
    ['no tax', '1', '100', '', '0'],
    ['a fractional quantity', '1.5', '100', '10', '0'],
    ['a rate that is not a number', '1', 'abc', '10', '0'],
    ['a rate with three decimals', '1', '9.999', '10', '0'],
    ['a negative tax', '1', '100', '-5', '0'],
    ['a discount that is not a number', '1', '100', '10', 'ten'],
  ])('gives no estimate for %s', (_case, quantity, rate, tax, discount) => {
    expect(estimate(quantity, rate, tax, discount)).toBeNull()
  })
})

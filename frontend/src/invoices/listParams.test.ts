import {
  DEFAULT_LIST_PARAMS,
  isDateRangeInverted,
  parseListParams,
  toSearchParams,
} from './listParams'

const parse = (query: string) => parseListParams(new URLSearchParams(query))

describe('parseListParams', () => {
  it('returns the defaults for an empty query string', () => {
    expect(parse('')).toEqual({
      page: 1,
      pageSize: 10,
      sortBy: 'invoiceDate',
      ordering: 'DESC',
      status: undefined,
      keyword: undefined,
      fromDate: undefined,
      toDate: undefined,
    })
  })

  it('reads every parameter', () => {
    expect(
      parse(
        'page=3&pageSize=25&sortBy=totalAmount&ordering=ASC&status=Overdue&keyword=paul&fromDate=2026-06-01&toDate=2026-06-30',
      ),
    ).toEqual({
      page: 3,
      pageSize: 25,
      sortBy: 'totalAmount',
      ordering: 'ASC',
      status: 'Overdue',
      keyword: 'paul',
      fromDate: '2026-06-01',
      toDate: '2026-06-30',
    })
  })

  it.each([
    ['page=0', { page: 1 }],
    ['page=-2', { page: 1 }],
    ['page=1.5', { page: 1 }],
    ['page=abc', { page: 1 }],
    ['pageSize=7', { pageSize: 10 }],
    ['pageSize=1000', { pageSize: 10 }],
    ['sortBy=password', { sortBy: 'invoiceDate' }],
    ['ordering=sideways', { ordering: 'DESC' }],
    ['status=Late', { status: undefined }],
    ['keyword=%20%20', { keyword: undefined }],
    ['fromDate=yesterday', { fromDate: undefined }],
    ['fromDate=2026-02-30', { fromDate: undefined }],
    ['toDate=30/06/2026', { toDate: undefined }],
  ])('ignores the invalid %s', (query, expected) => {
    expect(parse(query)).toMatchObject(expected)
  })

  it('accepts the ordering in lower case and trims the keyword', () => {
    expect(parse('ordering=asc&keyword=%20paul%20')).toMatchObject({
      ordering: 'ASC',
      keyword: 'paul',
    })
  })
})

describe('toSearchParams', () => {
  it('writes nothing for the defaults, keeping the URL clean', () => {
    expect(toSearchParams(DEFAULT_LIST_PARAMS).toString()).toBe('')
  })

  it('writes only what differs from the defaults', () => {
    expect(
      toSearchParams({ ...DEFAULT_LIST_PARAMS, status: 'Paid' }).toString(),
    ).toBe('status=Paid')
    expect(toSearchParams({ ...DEFAULT_LIST_PARAMS, page: 2 }).toString()).toBe(
      'page=2',
    )
  })

  it('writes sort field and direction together', () => {
    expect(
      toSearchParams({ ...DEFAULT_LIST_PARAMS, ordering: 'ASC' }).toString(),
    ).toBe('sortBy=invoiceDate&ordering=ASC')
  })

  it('round-trips through parseListParams', () => {
    const params = {
      page: 4,
      pageSize: 50,
      sortBy: 'dueDate',
      ordering: 'ASC',
      status: 'Pending',
      keyword: 'bennett & co',
    } as const

    expect(parseListParams(toSearchParams(params))).toEqual(params)
  })
})

describe('date range', () => {
  it('is written to the URL and read back', () => {
    const search = toSearchParams({
      ...DEFAULT_LIST_PARAMS,
      fromDate: '2026-06-01',
      toDate: '2026-06-30',
    })

    expect(search.toString()).toBe('fromDate=2026-06-01&toDate=2026-06-30')
    expect(parseListParams(search)).toMatchObject({
      fromDate: '2026-06-01',
      toDate: '2026-06-30',
    })
  })

  it('may have only one end', () => {
    expect(parse('fromDate=2026-06-01')).toMatchObject({
      fromDate: '2026-06-01',
      toDate: undefined,
    })
  })

  it.each([
    ['ends before it starts', '2026-06-10', '2026-06-09', true],
    ['is a single day', '2026-06-10', '2026-06-10', false],
    ['runs forwards', '2026-06-01', '2026-06-30', false],
    ['has no start', undefined, '2026-06-30', false],
    ['has no end', '2026-06-01', undefined, false],
    ['is not set', undefined, undefined, false],
  ])('a range that %s: inverted = %s', (_case, fromDate, toDate, inverted) => {
    expect(
      isDateRangeInverted({ ...DEFAULT_LIST_PARAMS, fromDate, toDate }),
    ).toBe(inverted)
  })
})

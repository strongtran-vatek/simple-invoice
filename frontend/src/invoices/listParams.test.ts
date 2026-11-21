import {
  DEFAULT_LIST_PARAMS,
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
    })
  })

  it('reads every parameter', () => {
    expect(
      parse(
        'page=3&pageSize=25&sortBy=totalAmount&ordering=ASC&status=Overdue&keyword=paul',
      ),
    ).toEqual({
      page: 3,
      pageSize: 25,
      sortBy: 'totalAmount',
      ordering: 'ASC',
      status: 'Overdue',
      keyword: 'paul',
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

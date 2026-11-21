import { type ArgumentMetadata, BadRequestException } from '@nestjs/common';
import {
  findNullCharacters,
  RejectNullCharactersPipe,
} from './reject-null-characters.pipe.js';

const NUL = '\u0000';

describe('findNullCharacters', () => {
  it('finds nothing in ordinary values', () => {
    expect(
      findNullCharacters({
        invoiceNumber: 'INV-1',
        customer: { fullname: 'Paul', address: null },
        items: [{ name: 'Honda RC150', quantity: 2, rate: 1000 }],
        tax: 10,
        flag: true,
      }),
    ).toEqual([]);
    expect(findNullCharacters(undefined)).toEqual([]);
    expect(findNullCharacters('plain text')).toEqual([]);
  });

  it('names the path of every affected string, however deep', () => {
    expect(
      findNullCharacters({
        invoiceNumber: `INV${NUL}1`,
        customer: { fullname: `Pa${NUL}ul`, email: 'paul@101digital.io' },
        items: [{ name: `${NUL}` }],
      }),
    ).toEqual(['invoiceNumber', 'customer.fullname', 'items.0.name']);
  });

  it('uses the given path for a bare string', () => {
    expect(findNullCharacters(`a${NUL}b`, 'id')).toEqual(['id']);
  });

  it('leaves other control characters and escapes alone', () => {
    expect(
      findNullCharacters({ text: 'line one\nline two\ttabbed \\0 %00' }),
    ).toEqual([]);
  });
});

describe('RejectNullCharactersPipe', () => {
  const pipe = new RejectNullCharactersPipe();
  const body: ArgumentMetadata = { type: 'body' };
  const query: ArgumentMetadata = { type: 'query' };

  it('passes a clean value through unchanged', () => {
    const value = { keyword: 'paul', page: '2' };

    expect(pipe.transform(value, query)).toBe(value);
  });

  it('rejects a query value with 400 and a message per field', () => {
    expect(() => pipe.transform({ keyword: `a${NUL}b` }, query)).toThrow(
      BadRequestException,
    );
    try {
      pipe.transform({ keyword: `a${NUL}b` }, query);
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({
        statusCode: 400,
        message: ['keyword must not contain a null character'],
        error: 'Bad Request',
      });
    }
  });

  it('rejects a nested body value', () => {
    expect(() =>
      pipe.transform({ customer: { fullname: `A${NUL}B` } }, body),
    ).toThrow('Bad Request');
  });

  it('names a single route parameter', () => {
    try {
      pipe.transform(`x${NUL}`, { type: 'param', data: 'id' });
      expect.unreachable();
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({
        message: ['id must not contain a null character'],
      });
    }
  });

  it('does not inspect values supplied by the server', () => {
    const user = { id: '1', fullname: `server${NUL}value` };

    expect(pipe.transform(user, { type: 'custom' })).toBe(user);
  });
});

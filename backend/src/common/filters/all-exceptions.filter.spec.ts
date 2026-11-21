import {
  BadRequestException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { toErrorBody } from './all-exceptions.filter.js';

describe('toErrorBody', () => {
  it('keeps the status, message and error name of an HTTP exception', () => {
    expect(toErrorBody(new NotFoundException('Invoice not found'))).toEqual({
      statusCode: 404,
      message: 'Invoice not found',
      error: 'Not Found',
    });
  });

  it('keeps a list of validation messages as a list', () => {
    const exception = new BadRequestException([
      'dueDate must be on or after invoiceDate',
    ]);

    expect(toErrorBody(exception)).toEqual({
      statusCode: 400,
      message: ['dueDate must be on or after invoiceDate'],
      error: 'Bad Request',
    });
  });

  it('names the error from the status when the exception carries only a string', () => {
    expect(toErrorBody(new HttpException('Slow down', 429))).toEqual({
      statusCode: 429,
      message: 'Slow down',
      error: 'Too Many Requests',
    });
  });

  it('hides the details of an unexpected error', () => {
    const body = toErrorBody(new Error('connection to 10.0.0.5 refused'));

    expect(body).toEqual({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
  });

  it('handles a thrown non-error value', () => {
    expect(toErrorBody('boom').statusCode).toBe(500);
  });
});

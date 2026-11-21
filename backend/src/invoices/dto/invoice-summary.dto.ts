import { ApiProperty } from '@nestjs/swagger';
import { SUPPORTED_CURRENCIES } from '../../common/currencies.js';
import { InvoiceStatus } from '../invoice-status.enum.js';

export class InvoiceSummaryCustomerDto {
  @ApiProperty({ example: 'Paul' })
  fullname: string;
}

/**
 * One row of the invoice list. Its fields are a subset of the invoice detail,
 * with the same names and nesting.
 */
export class InvoiceSummaryDto {
  @ApiProperty({ format: 'uuid' })
  invoiceId: string;

  @ApiProperty({ example: 'IV1780488206995' })
  invoiceNumber: string;

  @ApiProperty({ format: 'date', example: '2026-06-03' })
  invoiceDate: string;

  @ApiProperty({ format: 'date', example: '2026-07-03' })
  dueDate: string;

  @ApiProperty({
    enum: SUPPORTED_CURRENCIES,
    example: 'AUD',
    description: 'ISO 4217 code',
  })
  currency: string;

  @ApiProperty({
    example: 'AU$',
    description: 'Derived from the currency by the server',
  })
  currencySymbol: string;

  @ApiProperty({
    example: 2180,
    description: 'invoiceSubTotal + totalTax − totalDiscount',
  })
  totalAmount: number;

  @ApiProperty({
    enum: InvoiceStatus,
    description: 'Effective status; Overdue is derived at read time',
  })
  status: InvoiceStatus;

  @ApiProperty({ type: InvoiceSummaryCustomerDto })
  customer: InvoiceSummaryCustomerDto;
}

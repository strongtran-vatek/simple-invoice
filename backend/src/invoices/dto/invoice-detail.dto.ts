import { ApiProperty, OmitType } from '@nestjs/swagger';
import { InvoiceSummaryDto } from './invoice-summary.dto.js';

export class InvoiceCustomerDto {
  @ApiProperty({ example: 'Paul' })
  fullname: string;

  @ApiProperty({ format: 'email', example: 'paul@101digital.io' })
  email: string;

  @ApiProperty({ type: String, nullable: true, example: '947717364111' })
  mobileNumber: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Singapore' })
  address: string | null;
}

export class InvoiceItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Honda RC150' })
  name: string;

  @ApiProperty({ type: 'integer', example: 2 })
  quantity: number;

  @ApiProperty({ example: 1000, description: 'Price per unit' })
  rate: number;

  @ApiProperty({
    example: 2000,
    description: 'quantity × rate, calculated by the server',
  })
  amount: number;
}

/**
 * A complete invoice, shaped like the record in Appendix A of the
 * specification. Everything in a list row is here under the same name.
 */
export class InvoiceDetailDto extends OmitType(InvoiceSummaryDto, [
  'customer',
] as const) {
  @ApiProperty({ type: String, nullable: true, example: '#5721662' })
  invoiceReference: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Invoice is issued to Kanglee',
  })
  description: string | null;

  @ApiProperty({ example: 10, description: 'Tax as a percentage' })
  taxRate: number;

  @ApiProperty({ example: 2000, description: 'quantity × rate' })
  invoiceSubTotal: number;

  @ApiProperty({ example: 200, description: 'invoiceSubTotal × taxRate / 100' })
  totalTax: number;

  @ApiProperty({ example: 20, description: 'An amount, not a percentage' })
  totalDiscount: number;

  @ApiProperty({
    example: 1451.34,
    description: 'Payments received so far; 0 for a new invoice',
  })
  totalPaid: number;

  @ApiProperty({ example: 728.66, description: 'totalAmount − totalPaid' })
  balanceAmount: number;

  @ApiProperty({ type: InvoiceCustomerDto })
  customer: InvoiceCustomerDto;

  @ApiProperty({ type: [InvoiceItemDto] })
  items: InvoiceItemDto[];

  @ApiProperty({ format: 'date-time', example: '2026-06-03T12:03:26.995Z' })
  createdAt: string;

  @ApiProperty({ format: 'uuid', description: 'Id of the creating user' })
  createdBy: string;
}

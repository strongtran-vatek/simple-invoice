import { ApiProperty } from '@nestjs/swagger';
import { InvoiceSummaryDto } from './invoice-summary.dto.js';

export class PagingDto {
  @ApiProperty({ example: 1, description: 'Page number, starting at 1' })
  page: number;

  @ApiProperty({ example: 10 })
  pageSize: number;

  @ApiProperty({
    example: 100,
    description: 'Number of invoices matching the filters, across all pages',
  })
  total: number;
}

export class InvoiceListResponseDto {
  @ApiProperty({ type: [InvoiceSummaryDto] })
  data: InvoiceSummaryDto[];

  @ApiProperty({ type: PagingDto })
  paging: PagingDto;
}

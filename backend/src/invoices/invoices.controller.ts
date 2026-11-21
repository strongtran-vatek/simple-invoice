import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { InvoiceListResponseDto } from './dto/invoice-list-response.dto.js';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto.js';
import { InvoicesService } from './invoices.service.js';

@ApiTags('invoices')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'The token is missing, invalid or expired',
})
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @ApiOperation({
    summary: 'List invoices with search, filter, sort and pagination',
  })
  @ApiOkResponse({ type: InvoiceListResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'A query parameter is invalid',
  })
  list(@Query() query: ListInvoicesQueryDto): Promise<InvoiceListResponseDto> {
    return this.invoices.list(query);
  }
}

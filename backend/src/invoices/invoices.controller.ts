import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { InvoiceDetailDto } from './dto/invoice-detail.dto.js';
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

  @Get(':id')
  @ApiOperation({ summary: 'Get one invoice with its customer and line items' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'The invoice id' })
  @ApiOkResponse({ type: InvoiceDetailDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'The id is not a UUID',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'No invoice has this id',
  })
  findOne(
    // Rejected here so a malformed id is a 400, not a database error.
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new BadRequestException('id must be a valid UUID'),
      }),
    )
    id: string,
  ): Promise<InvoiceDetailDto> {
    return this.invoices.findOne(id);
  }
}

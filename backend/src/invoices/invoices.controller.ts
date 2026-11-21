import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
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
    description:
      'Every parameter is optional and they combine. Paging is done by the server: `paging.total` counts the invoices that match, across all pages. A page past the last one is an empty list, not an error.',
  })
  @ApiOkResponse({
    type: InvoiceListResponseDto,
    description: 'One page of matching invoices',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'A query parameter is invalid',
  })
  list(@Query() query: ListInvoicesQueryDto): Promise<InvoiceListResponseDto> {
    return this.invoices.list(query);
  }

  @Post()
  @ApiOperation({
    summary: 'Create an invoice',
    description:
      'The invoice is created as a Draft. The server calculates the subtotal, tax, total and balance.',
  })
  @ApiCreatedResponse({
    type: InvoiceDetailDto,
    description: 'The invoice as stored, with its calculated amounts',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description:
      'A field is invalid, or the discount exceeds the subtotal plus tax',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'The invoice number is already in use',
  })
  create(
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InvoiceDetailDto> {
    return this.invoices.create(dto, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one invoice with its customer and line items' })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'The invoice id (`invoiceId` in the list)',
  })
  @ApiOkResponse({ type: InvoiceDetailDto, description: 'The invoice' })
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

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsDateOnly } from '../../common/validators/is-date-only.js';
import { IsOnOrAfter } from '../../common/validators/is-on-or-after.js';
import { InvoiceStatus } from '../invoice-status.enum.js';

export enum InvoiceSortField {
  InvoiceDate = 'invoiceDate',
  DueDate = 'dueDate',
  TotalAmount = 'totalAmount',
}

export enum SortOrder {
  Asc = 'ASC',
  Desc = 'DESC',
}

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

/** `?status=` with no value means "no filter", not an invalid status. */
const blankToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

const upperCased = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() || undefined : value;

/** Query parameters of `GET /invoices`. Every one is optional. */
export class ListInvoicesQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number;

  @ApiPropertyOptional({
    enum: InvoiceSortField,
    default: InvoiceSortField.InvoiceDate,
  })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsEnum(InvoiceSortField, {
    message: 'sortBy must be one of: invoiceDate, dueDate, totalAmount',
  })
  sortBy?: InvoiceSortField;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.Desc })
  @IsOptional()
  @Transform(upperCased)
  @IsEnum(SortOrder, { message: 'ordering must be ASC or DESC' })
  ordering?: SortOrder;

  @ApiPropertyOptional({
    enum: InvoiceStatus,
    description:
      'Filters by effective status. Overdue matches unpaid invoices past their due date; Draft and Pending exclude them.',
  })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsEnum(InvoiceStatus, {
    message: 'status must be one of: Draft, Pending, Paid, Overdue',
  })
  status?: InvoiceStatus;

  @ApiPropertyOptional({
    description:
      'Partial, case-insensitive match on invoice number or customer name',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @ApiPropertyOptional({
    format: 'date',
    example: '2026-06-01',
    description: 'Only invoices dated on or after this date',
  })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsDateOnly()
  fromDate?: string;

  @ApiPropertyOptional({
    format: 'date',
    example: '2026-06-30',
    description: 'Only invoices dated on or before this date',
  })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsDateOnly()
  @IsOnOrAfter('fromDate')
  toDate?: string;
}

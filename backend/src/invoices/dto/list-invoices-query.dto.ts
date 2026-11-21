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
/**
 * Far beyond any real page. It keeps the row offset (page × pageSize) a
 * number the database accepts, so an absurd page is a 400 and not a 500.
 */
export const MAX_PAGE = 1_000_000;

/** `?status=` with no value means "no filter", not an invalid status. */
const blankToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/**
 * The same for numeric parameters. `@Type` has already turned `page=` into 0
 * by the time this runs, so it looks at the text that was actually sent.
 */
const blankNumberToUndefined = ({
  value,
  obj,
  key,
}: {
  value: unknown;
  obj: Record<string, unknown>;
  key: string;
}) => {
  const sent = obj[key];
  return typeof sent === 'string' && sent.trim() === '' ? undefined : value;
};

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

const upperCased = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() || undefined : value;

/** Query parameters of `GET /invoices`. Every one is optional. */
export class ListInvoicesQueryDto {
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    default: 1,
    maximum: MAX_PAGE,
    description: 'Page number, starting at 1',
  })
  @IsOptional()
  @Type(() => Number)
  @Transform(blankNumberToUndefined)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE)
  page?: number;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
    description: 'Invoices per page',
  })
  @IsOptional()
  @Type(() => Number)
  @Transform(blankNumberToUndefined)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number;

  @ApiPropertyOptional({
    enum: InvoiceSortField,
    default: InvoiceSortField.InvoiceDate,
    description: 'The field to sort by',
  })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsEnum(InvoiceSortField, {
    message: 'sortBy must be one of: invoiceDate, dueDate, totalAmount',
  })
  sortBy?: InvoiceSortField;

  @ApiPropertyOptional({
    enum: SortOrder,
    default: SortOrder.Desc,
    description: 'Ascending or descending; letter case is ignored',
  })
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
    description:
      'Only invoices dated on or before this date. Must not be before fromDate.',
  })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsDateOnly()
  @IsOnOrAfter('fromDate')
  toDate?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  type CurrencyCode,
  SUPPORTED_CURRENCIES,
} from '../../common/currencies.js';
import { HasExactlyOneElement } from '../../common/validators/has-exactly-one-element.js';
import { IsDateOnly } from '../../common/validators/is-date-only.js';
import { IsOnOrAfter } from '../../common/validators/is-on-or-after.js';

/** The tax rate, in percent, applied when a request does not give one. */
export const DEFAULT_TAX_RATE = 10;
export const MAX_TAX_RATE = 100;
export const MAX_QUANTITY = 1_000_000;
export const MAX_RATE = 999_999_999.99;
/** The largest amount a `numeric(14,2)` column can hold. */
export const MAX_AMOUNT = 999_999_999_999.99;

type Transformed = { value: unknown };

const trimmed = ({ value }: Transformed) =>
  typeof value === 'string' ? value.trim() : value;

/** An optional text field left blank is the same as one left out. */
const trimmedOrAbsent = ({ value }: Transformed) =>
  typeof value === 'string' ? value.trim() || undefined : value;

const upperCased = ({ value }: Transformed) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const amountMessage = (property: string) =>
  `${property} must be a number with at most 2 decimal places`;

export class CreateInvoiceCustomerDto {
  @ApiProperty({ example: 'Paul', maxLength: 255 })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty({ message: 'fullname must not be empty' })
  @MaxLength(255)
  fullname: string;

  @ApiProperty({ example: 'paul@101digital.io', maxLength: 255 })
  @Transform(trimmed)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({ example: '947717364111', maxLength: 50 })
  @IsOptional()
  @Transform(trimmedOrAbsent)
  @IsString()
  @MaxLength(50)
  mobileNumber?: string;

  @ApiPropertyOptional({ example: 'Singapore', maxLength: 500 })
  @IsOptional()
  @Transform(trimmedOrAbsent)
  @IsString()
  @MaxLength(500)
  address?: string;
}

export class CreateInvoiceItemDto {
  @ApiProperty({ example: 'Honda RC150', maxLength: 255 })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty({ message: 'name must not be empty' })
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: MAX_QUANTITY })
  @IsInt({ message: 'quantity must be a whole number' })
  @Min(1)
  @Max(MAX_QUANTITY)
  quantity: number;

  @ApiProperty({
    example: 1000,
    maximum: MAX_RATE,
    description: 'Price per unit; greater than 0, at most 2 decimal places',
  })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: amountMessage('rate') })
  @IsPositive({ message: 'rate must be greater than 0' })
  @Max(MAX_RATE)
  rate: number;
}

/**
 * The body of `POST /invoices`. It carries no status and no totals: a new
 * invoice is always a Draft, and the server works out every amount.
 */
export class CreateInvoiceDto {
  @ApiProperty({
    example: 'INV-2026-0042',
    maxLength: 50,
    description:
      'Must be unique. Surrounding spaces and letter case are ignored when comparing.',
  })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty({ message: 'invoiceNumber must not be empty' })
  @MaxLength(50)
  invoiceNumber: string;

  @ApiPropertyOptional({ example: '#5721662', maxLength: 50 })
  @IsOptional()
  @Transform(trimmedOrAbsent)
  @IsString()
  @MaxLength(50)
  invoiceReference?: string;

  @ApiProperty({ format: 'date', example: '2026-06-03' })
  @IsDateOnly()
  invoiceDate: string;

  @ApiProperty({
    format: 'date',
    example: '2026-07-03',
    description: 'On or after invoiceDate',
  })
  @IsDateOnly()
  @IsOnOrAfter('invoiceDate')
  dueDate: string;

  @ApiProperty({ enum: SUPPORTED_CURRENCIES, example: 'AUD' })
  @Transform(upperCased)
  @IsIn(SUPPORTED_CURRENCIES, {
    message: `currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`,
  })
  currency: CurrencyCode;

  @ApiPropertyOptional({
    example: 'Invoice is issued to Kanglee',
    maxLength: 500,
  })
  @IsOptional()
  @Transform(trimmedOrAbsent)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ type: CreateInvoiceCustomerDto })
  @IsObject({ message: 'customer must be an object' })
  @ValidateNested()
  @Type(() => CreateInvoiceCustomerDto)
  customer: CreateInvoiceCustomerDto;

  @ApiProperty({
    type: [CreateInvoiceItemDto],
    minItems: 1,
    maxItems: 1,
    description: 'Exactly one line item',
  })
  @HasExactlyOneElement({ message: 'items must contain exactly one item' })
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];

  @ApiPropertyOptional({
    example: 10,
    default: DEFAULT_TAX_RATE,
    minimum: 0,
    maximum: MAX_TAX_RATE,
    description:
      'Tax as a percentage of the subtotal, with at most 2 decimal places',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: amountMessage('tax') })
  @Min(0)
  @Max(MAX_TAX_RATE)
  tax?: number;

  @ApiPropertyOptional({
    example: 20,
    default: 0,
    minimum: 0,
    description:
      'An amount in the invoice currency, not a percentage. It may not exceed the subtotal plus tax.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: amountMessage('discount') })
  @Min(0)
  @Max(MAX_AMOUNT)
  discount?: number;
}

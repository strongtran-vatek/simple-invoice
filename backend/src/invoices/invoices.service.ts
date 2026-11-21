import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Decimal } from 'decimal.js';
import { QueryFailedError, Repository, type SelectQueryBuilder } from 'typeorm';
import { Clock } from '../common/clock.js';
import { CURRENCY_SYMBOLS } from '../common/currencies.js';
import {
  type CreateInvoiceDto,
  DEFAULT_TAX_RATE,
  MAX_AMOUNT,
} from './dto/create-invoice.dto.js';
import type { InvoiceDetailDto } from './dto/invoice-detail.dto.js';
import type { InvoiceListResponseDto } from './dto/invoice-list-response.dto.js';
import {
  DEFAULT_PAGE_SIZE,
  InvoiceSortField,
  type ListInvoicesQueryDto,
  SortOrder,
} from './dto/list-invoices-query.dto.js';
import { calculateInvoiceAmounts } from './invoice-calculator.js';
import { InvoiceStatus, StoredInvoiceStatus } from './invoice-status.enum.js';
import { Invoice } from './invoice.entity.js';
import { toInvoiceDetail, toInvoiceSummary } from './invoice.mapper.js';

/** The only columns a client may sort by; anything else never reaches SQL. */
const SORT_COLUMNS: Record<InvoiceSortField, string> = {
  [InvoiceSortField.InvoiceDate]: 'invoice.invoiceDate',
  [InvoiceSortField.DueDate]: 'invoice.dueDate',
  [InvoiceSortField.TotalAmount]: 'invoice.totalAmount',
};

/** Escapes LIKE wildcards so a search for "50%" matches that text literally. */
export function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&');
}

/** PostgreSQL's error code for a unique constraint violation. */
const UNIQUE_VIOLATION = '23505';
const INVOICE_NUMBER_INDEX = 'uq_invoices_invoice_number_lower';

/** True when an insert failed because the invoice number is already taken. */
export function isDuplicateInvoiceNumber(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const { code, constraint } = error.driverError as {
    code?: string;
    constraint?: string;
  };
  return code === UNIQUE_VIOLATION && constraint === INVOICE_NUMBER_INDEX;
}

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice) private readonly invoices: Repository<Invoice>,
    private readonly clock: Clock,
  ) {}

  /** Lists invoices with search, filters, sorting and server-side pagination. */
  async list(query: ListInvoicesQueryDto): Promise<InvoiceListResponseDto> {
    const today = this.clock.today();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const sortBy = query.sortBy ?? InvoiceSortField.InvoiceDate;
    const ordering = query.ordering ?? SortOrder.Desc;

    const builder = this.invoices.createQueryBuilder('invoice');

    if (query.keyword) {
      builder.andWhere(
        `(invoice.invoiceNumber ILIKE :keyword ESCAPE '\\' OR invoice.customerFullname ILIKE :keyword ESCAPE '\\')`,
        { keyword: `%${escapeLikePattern(query.keyword)}%` },
      );
    }
    if (query.status) {
      this.filterByEffectiveStatus(builder, query.status, today);
    }
    if (query.fromDate) {
      builder.andWhere('invoice.invoiceDate >= :fromDate', {
        fromDate: query.fromDate,
      });
    }
    if (query.toDate) {
      builder.andWhere('invoice.invoiceDate <= :toDate', {
        toDate: query.toDate,
      });
    }

    const [invoices, total] = await builder
      .orderBy(SORT_COLUMNS[sortBy], ordering)
      // A tiebreaker keeps rows with equal sort values from moving between pages.
      .addOrderBy('invoice.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      data: invoices.map((invoice) => toInvoiceSummary(invoice, today)),
      paging: { page, pageSize, total },
    };
  }

  /** Returns one invoice with its customer and line items, or throws 404. */
  async findOne(id: string): Promise<InvoiceDetailDto> {
    const invoice = await this.invoices.findOne({
      where: { id },
      relations: { items: true },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return toInvoiceDetail(invoice, this.clock.today());
  }

  /**
   * Creates a Draft invoice with its single line item and returns it in full.
   * Every amount is worked out here; the request carries none.
   */
  async create(
    dto: CreateInvoiceDto,
    createdBy: string,
  ): Promise<InvoiceDetailDto> {
    const [item] = dto.items;
    const taxRate = dto.tax ?? DEFAULT_TAX_RATE;
    const amounts = calculateInvoiceAmounts({
      quantity: item.quantity,
      rate: item.rate,
      taxRate,
      discount: dto.discount ?? 0,
    });

    if (new Decimal(amounts.totalAmount).isNegative()) {
      throw new BadRequestException(
        'discount must not exceed the subtotal plus tax',
      );
    }
    // The total is at most subtotal + tax, so this bounds every stored amount.
    if (
      new Decimal(amounts.subTotal)
        .plus(amounts.taxAmount)
        .greaterThan(MAX_AMOUNT)
    ) {
      throw new BadRequestException(
        'The invoice amount is too large to be recorded',
      );
    }

    let invoiceId: string;
    try {
      // The invoice and its item are written in one transaction.
      const saved = await this.invoices.save(
        this.invoices.create({
          invoiceNumber: dto.invoiceNumber,
          invoiceReference: dto.invoiceReference ?? null,
          invoiceDate: dto.invoiceDate,
          dueDate: dto.dueDate,
          currency: dto.currency,
          currencySymbol: CURRENCY_SYMBOLS[dto.currency],
          description: dto.description ?? null,
          status: StoredInvoiceStatus.Draft,
          taxRate: new Decimal(taxRate).toFixed(2),
          invoiceSubTotal: amounts.subTotal,
          totalTax: amounts.taxAmount,
          totalDiscount: amounts.discount,
          totalAmount: amounts.totalAmount,
          totalPaid: amounts.totalPaid,
          balanceAmount: amounts.balanceAmount,
          customerFullname: dto.customer.fullname,
          customerEmail: dto.customer.email,
          customerMobile: dto.customer.mobileNumber ?? null,
          customerAddress: dto.customer.address ?? null,
          createdBy,
          items: [
            {
              name: item.name,
              quantity: item.quantity,
              rate: new Decimal(item.rate).toFixed(2),
            },
          ],
        }),
      );
      invoiceId = saved.id;
    } catch (error) {
      // The unique index is the check, so two simultaneous creates cannot
      // both pass (docs/adr/0007).
      if (isDuplicateInvoiceNumber(error)) {
        throw new ConflictException(
          'An invoice with this invoice number already exists',
        );
      }
      throw error;
    }

    // Read back, so the response is exactly what GET /invoices/:id returns.
    return this.findOne(invoiceId);
  }

  /**
   * Filters on the effective status in SQL, so page totals stay correct.
   * Mirrors `deriveInvoiceStatus`; the four filters partition the invoices
   * (docs/adr/0003).
   */
  private filterByEffectiveStatus(
    builder: SelectQueryBuilder<Invoice>,
    status: InvoiceStatus,
    today: string,
  ): void {
    switch (status) {
      case InvoiceStatus.Overdue:
        builder.andWhere(
          '(invoice.status <> :paid AND invoice.dueDate < :today)',
          { paid: StoredInvoiceStatus.Paid, today },
        );
        break;
      case InvoiceStatus.Paid:
        builder.andWhere('invoice.status = :status', { status });
        break;
      case InvoiceStatus.Draft:
      case InvoiceStatus.Pending:
        builder.andWhere(
          '(invoice.status = :status AND invoice.dueDate >= :today)',
          { status, today },
        );
        break;
    }
  }
}

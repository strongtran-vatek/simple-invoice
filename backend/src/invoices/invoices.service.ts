import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type SelectQueryBuilder } from 'typeorm';
import { Clock } from '../common/clock.js';
import type { InvoiceDetailDto } from './dto/invoice-detail.dto.js';
import type { InvoiceListResponseDto } from './dto/invoice-list-response.dto.js';
import {
  DEFAULT_PAGE_SIZE,
  InvoiceSortField,
  type ListInvoicesQueryDto,
  SortOrder,
} from './dto/list-invoices-query.dto.js';
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

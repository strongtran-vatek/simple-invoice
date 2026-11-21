import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { User } from '../users/user.entity.js';
import { InvoiceItem } from './invoice-item.entity.js';
import { StoredInvoiceStatus } from './invoice-status.enum.js';

/**
 * An invoice with its customer snapshot (see docs/adr/0002).
 *
 * Money columns are `numeric`, which the driver returns as strings so no
 * precision is lost. Date columns are plain `YYYY-MM-DD` strings.
 */
@Entity({ name: 'invoices' })
@Index('idx_invoices_invoice_date', ['invoiceDate'])
@Index('idx_invoices_due_date', ['dueDate'])
@Index('idx_invoices_total_amount', ['totalAmount'])
// Serves the status filter, including the derived Overdue check on due_date.
@Index('idx_invoices_status_due_date', ['status', 'dueDate'])
@Index('idx_invoices_created_by', ['createdBy'])
// The case-insensitive unique index on lower(invoice_number) is an expression
// index, which TypeORM cannot describe. The migration owns it (see docs/adr/0007).
@Index('uq_invoices_invoice_number_lower', { synchronize: false })
@Check('chk_invoices_due_date', 'due_date >= invoice_date')
@Check('chk_invoices_tax_rate', 'tax_rate >= 0')
@Check(
  'chk_invoices_amounts_non_negative',
  'invoice_sub_total >= 0 AND total_tax >= 0 AND total_discount >= 0 AND total_amount >= 0 AND total_paid >= 0',
)
@Check(
  'chk_invoices_total',
  'total_amount = invoice_sub_total + total_tax - total_discount',
)
@Check('chk_invoices_balance', 'balance_amount = total_amount - total_paid')
export class Invoice {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_invoices' })
  id: string;

  @Column({ name: 'invoice_number', type: 'varchar', length: 50 })
  invoiceNumber: string;

  @Column({
    name: 'invoice_reference',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  invoiceReference: string | null;

  @Column({ name: 'invoice_date', type: 'date' })
  invoiceDate: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ name: 'currency_symbol', type: 'varchar', length: 8 })
  currencySymbol: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: StoredInvoiceStatus,
    enumName: 'invoice_status',
    default: StoredInvoiceStatus.Draft,
  })
  status: StoredInvoiceStatus;

  @Column({ name: 'tax_rate', type: 'numeric', precision: 5, scale: 2 })
  taxRate: string;

  @Column({
    name: 'invoice_sub_total',
    type: 'numeric',
    precision: 14,
    scale: 2,
  })
  invoiceSubTotal: string;

  @Column({ name: 'total_tax', type: 'numeric', precision: 14, scale: 2 })
  totalTax: string;

  @Column({
    name: 'total_discount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
  })
  totalDiscount: string;

  @Column({ name: 'total_amount', type: 'numeric', precision: 14, scale: 2 })
  totalAmount: string;

  @Column({
    name: 'total_paid',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
  })
  totalPaid: string;

  @Column({ name: 'balance_amount', type: 'numeric', precision: 14, scale: 2 })
  balanceAmount: string;

  @Column({ name: 'customer_fullname', type: 'varchar', length: 255 })
  customerFullname: string;

  @Column({ name: 'customer_email', type: 'varchar', length: 255 })
  customerEmail: string;

  @Column({
    name: 'customer_mobile',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  customerMobile: string | null;

  @Column({
    name: 'customer_address',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  customerAddress: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  /** The creating user's id. An audit field, not an access filter. */
  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'created_by',
    foreignKeyConstraintName: 'fk_invoices_created_by',
  })
  creator: Relation<User>;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: ['insert'] })
  items: Relation<InvoiceItem[]>;
}

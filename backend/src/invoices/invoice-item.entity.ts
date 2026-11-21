import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Invoice } from './invoice.entity.js';

/**
 * A line item on an invoice. The API accepts exactly one per invoice for now;
 * the table already allows many.
 */
@Entity({ name: 'invoice_items' })
@Index('idx_invoice_items_invoice_id', ['invoiceId'])
@Check('chk_invoice_items_quantity', 'quantity > 0')
@Check('chk_invoice_items_rate', 'rate > 0')
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_invoice_items',
  })
  id: string;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.items, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'invoice_id',
    foreignKeyConstraintName: 'fk_invoice_items_invoice',
  })
  invoice: Relation<Invoice>;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  rate: string;
}

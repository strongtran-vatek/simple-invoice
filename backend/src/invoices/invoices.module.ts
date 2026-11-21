import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clock } from '../common/clock.js';
import { InvoiceItem } from './invoice-item.entity.js';
import { Invoice } from './invoice.entity.js';
import { InvoicesController } from './invoices.controller.js';
import { InvoicesService } from './invoices.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, InvoiceItem])],
  controllers: [InvoicesController],
  providers: [InvoicesService, Clock],
})
export class InvoicesModule {}

import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates users, invoices and invoice_items.
 *
 * Written by hand so every constraint and index is explicit. `gen_random_uuid()`
 * is built into PostgreSQL 13+, so no extension is needed.
 */
export class InitialSchema1763712000000 implements MigrationInterface {
  name = 'InitialSchema1763712000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying(255) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "fullname" character varying(255) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_users" PRIMARY KEY ("id"),
        CONSTRAINT "uq_users_email" UNIQUE ("email"),
        CONSTRAINT "chk_users_email_lowercase" CHECK (email = lower(email))
      )
    `);

    // Overdue is derived at read time, so it is not a storable value.
    await queryRunner.query(
      `CREATE TYPE "invoice_status" AS ENUM ('Draft', 'Pending', 'Paid')`,
    );

    await queryRunner.query(`
      CREATE TABLE "invoices" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "invoice_number" character varying(50) NOT NULL,
        "invoice_reference" character varying(50),
        "invoice_date" date NOT NULL,
        "due_date" date NOT NULL,
        "currency" character varying(3) NOT NULL,
        "currency_symbol" character varying(8) NOT NULL,
        "description" character varying(500),
        "status" "invoice_status" NOT NULL DEFAULT 'Draft',
        "tax_rate" numeric(5,2) NOT NULL,
        "invoice_sub_total" numeric(14,2) NOT NULL,
        "total_tax" numeric(14,2) NOT NULL,
        "total_discount" numeric(14,2) NOT NULL DEFAULT '0',
        "total_amount" numeric(14,2) NOT NULL,
        "total_paid" numeric(14,2) NOT NULL DEFAULT '0',
        "balance_amount" numeric(14,2) NOT NULL,
        "customer_fullname" character varying(255) NOT NULL,
        "customer_email" character varying(255) NOT NULL,
        "customer_mobile" character varying(50),
        "customer_address" character varying(500),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_by" uuid NOT NULL,
        CONSTRAINT "pk_invoices" PRIMARY KEY ("id"),
        CONSTRAINT "fk_invoices_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "chk_invoices_due_date" CHECK (due_date >= invoice_date),
        CONSTRAINT "chk_invoices_tax_rate" CHECK (tax_rate >= 0),
        CONSTRAINT "chk_invoices_amounts_non_negative" CHECK (
          invoice_sub_total >= 0 AND total_tax >= 0 AND total_discount >= 0
          AND total_amount >= 0 AND total_paid >= 0
        ),
        CONSTRAINT "chk_invoices_total" CHECK (
          total_amount = invoice_sub_total + total_tax - total_discount
        ),
        CONSTRAINT "chk_invoices_balance" CHECK (
          balance_amount = total_amount - total_paid
        )
      )
    `);

    // Invoice numbers are unique ignoring case (docs/adr/0007).
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_invoices_invoice_number_lower" ON "invoices" (lower("invoice_number"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_invoices_invoice_date" ON "invoices" ("invoice_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_invoices_due_date" ON "invoices" ("due_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_invoices_total_amount" ON "invoices" ("total_amount")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_invoices_status_due_date" ON "invoices" ("status", "due_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_invoices_created_by" ON "invoices" ("created_by")`,
    );

    await queryRunner.query(`
      CREATE TABLE "invoice_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "invoice_id" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "quantity" integer NOT NULL,
        "rate" numeric(14,2) NOT NULL,
        CONSTRAINT "pk_invoice_items" PRIMARY KEY ("id"),
        CONSTRAINT "fk_invoice_items_invoice" FOREIGN KEY ("invoice_id")
          REFERENCES "invoices" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "chk_invoice_items_quantity" CHECK (quantity > 0),
        CONSTRAINT "chk_invoice_items_rate" CHECK (rate > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_invoice_items_invoice_id" ON "invoice_items" ("invoice_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "invoice_items"`);
    await queryRunner.query(`DROP TABLE "invoices"`);
    await queryRunner.query(`DROP TYPE "invoice_status"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}

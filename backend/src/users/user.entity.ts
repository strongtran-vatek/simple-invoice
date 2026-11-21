import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/** A person who can log in. */
@Entity({ name: 'users' })
@Unique('uq_users_email', ['email'])
// Emails are stored lower-cased, so the plain unique constraint is case-insensitive.
@Check('chk_users_email_lowercase', 'email = lower(email)')
export class User {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_users' })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 255 })
  fullname: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

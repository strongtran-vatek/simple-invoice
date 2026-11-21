import { Inject, Injectable } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';

/** Injection token for the bcrypt cost factor, so tests can lower it. */
export const BCRYPT_ROUNDS = Symbol('BCRYPT_ROUNDS');

export const DEFAULT_BCRYPT_ROUNDS = 10;

@Injectable()
export class PasswordService {
  private placeholderHash?: Promise<string>;

  constructor(@Inject(BCRYPT_ROUNDS) private readonly rounds: number) {}

  hash(password: string): Promise<string> {
    return hash(password, this.rounds);
  }

  /**
   * Checks a password against a stored hash.
   *
   * When there is no hash (the email is not registered) it still runs a full
   * comparison against a placeholder, so an unknown email takes as long to
   * reject as a wrong password and response time does not reveal which emails exist.
   */
  async verify(
    password: string,
    storedHash: string | null | undefined,
  ): Promise<boolean> {
    const matches = await compare(
      password,
      storedHash ?? (await this.getPlaceholderHash()),
    );
    return storedHash != null && matches;
  }

  private getPlaceholderHash(): Promise<string> {
    this.placeholderHash ??= hash('placeholder-password', this.rounds);
    return this.placeholderHash;
  }
}

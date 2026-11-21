import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Environment } from '../config/env.validation.js';
import type { User } from '../users/user.entity.js';
import type { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';

const SECRET = 'unit-test-secret-of-at-least-32-chars';

describe('AuthService.login', () => {
  const passwords = new PasswordService(4);
  const jwt = new JwtService({
    secret: SECRET,
    signOptions: { expiresIn: 3600 },
  });
  const config = { get: () => 3600 } as unknown as ConfigService<
    Environment,
    true
  >;
  let registered: User;
  let auth: AuthService;

  beforeAll(async () => {
    registered = {
      id: '0b9d7f0e-6f1a-4c53-9b0a-2f6f1c1d2e3f',
      email: 'reviewer@example.com',
      passwordHash: await passwords.hash('s3cret'),
      fullname: 'Reviewer',
      createdAt: new Date(),
    };
    const users = {
      findByEmail: (email: string) =>
        Promise.resolve(email === registered.email ? registered : null),
    } as unknown as UsersService;
    auth = new AuthService(users, passwords, jwt, config);
  });

  it('returns a bearer token carrying the user id and email', async () => {
    const result = await auth.login('reviewer@example.com', 's3cret');

    expect(result.tokenType).toBe('Bearer');
    expect(result.expiresIn).toBe(3600);
    expect(jwt.verify(result.accessToken)).toMatchObject({
      sub: registered.id,
      email: 'reviewer@example.com',
    });
  });

  it('issues a token that expires after the configured lifetime', async () => {
    const { accessToken } = await auth.login('reviewer@example.com', 's3cret');
    const { iat, exp } = jwt.verify<{ iat: number; exp: number }>(accessToken);

    expect(exp - iat).toBe(3600);
  });

  it('never puts the password hash in the token', async () => {
    const { accessToken } = await auth.login('reviewer@example.com', 's3cret');

    expect(JSON.stringify(jwt.decode(accessToken))).not.toContain(
      registered.passwordHash,
    );
  });

  it('rejects a wrong password', async () => {
    await expect(auth.login('reviewer@example.com', 'wrong')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an unknown email with the same message as a wrong password', async () => {
    const wrongPassword = await auth
      .login('reviewer@example.com', 'wrong')
      .catch((error: Error) => error.message);
    const unknownEmail = await auth
      .login('nobody@example.com', 's3cret')
      .catch((error: Error) => error.message);

    expect(unknownEmail).toBe('Invalid email or password');
    expect(unknownEmail).toBe(wrongPassword);
  });
});

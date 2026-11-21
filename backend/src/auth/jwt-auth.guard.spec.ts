import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { User } from '../users/user.entity.js';
import type { UsersService } from '../users/users.service.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { Public } from './decorators/public.decorator.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const SECRET = 'unit-test-secret-of-at-least-32-chars';

const user: User = {
  id: '0b9d7f0e-6f1a-4c53-9b0a-2f6f1c1d2e3f',
  email: 'reviewer@example.com',
  passwordHash: 'hash',
  fullname: 'Reviewer',
  createdAt: new Date(),
};

class Routes {
  protectedRoute() {}

  @Public()
  publicRoute() {}
}

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({
    secret: SECRET,
    signOptions: { algorithm: 'HS256', expiresIn: 3600 },
    verifyOptions: { algorithms: ['HS256'] },
  });
  const findById = vi.fn<UsersService['findById']>();
  const guard = new JwtAuthGuard(new Reflector(), jwt, {
    findById,
  } as unknown as UsersService);

  /** Builds the context of a request to one of the routes above. */
  function contextFor(
    route: keyof Routes,
    authorization?: string,
  ): { context: ExecutionContext; request: AuthenticatedRequest } {
    const request = { headers: { authorization } } as AuthenticatedRequest;
    const context = {
      getHandler: () => Routes.prototype[route],
      getClass: () => Routes,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  const tokenFor = (subject: string, options = {}) =>
    jwt.sign({ sub: subject, email: user.email }, options);

  beforeEach(() => {
    findById.mockReset();
    findById.mockResolvedValue(user);
  });

  it('lets anyone reach a route marked @Public()', async () => {
    const { context } = contextFor('publicRoute');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(findById).not.toHaveBeenCalled();
  });

  it('rejects a request with no Authorization header', async () => {
    const { context } = contextFor('protectedRoute');

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Authentication required'),
    );
  });

  it('rejects a header that is not a Bearer token', async () => {
    const { context } = contextFor('protectedRoute', 'Basic dXNlcjpwYXNz');

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('accepts a valid token and attaches the user without the password hash', async () => {
    const { context, request } = contextFor(
      'protectedRoute',
      `Bearer ${tokenFor(user.id)}`,
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      id: user.id,
      email: 'reviewer@example.com',
      fullname: 'Reviewer',
    });
  });

  it('rejects an expired token', async () => {
    const { context } = contextFor(
      'protectedRoute',
      `Bearer ${tokenFor(user.id, { expiresIn: -10 })}`,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid or expired token'),
    );
  });

  it('rejects a token signed with a different secret', async () => {
    const forged = new JwtService({
      secret: 'another-secret-of-at-least-32-characters',
    }).sign({ sub: user.id, email: user.email });
    const { context } = contextFor('protectedRoute', `Bearer ${forged}`);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token signed with an algorithm other than HS256', async () => {
    const { context } = contextFor(
      'protectedRoute',
      `Bearer ${tokenFor(user.id, { algorithm: 'HS512' })}`,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an unsigned token', async () => {
    const encode = (value: object) =>
      Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: user.id })}.`;
    const { context } = contextFor('protectedRoute', `Bearer ${unsigned}`);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a valid token whose user no longer exists', async () => {
    findById.mockResolvedValue(null);
    const { context } = contextFor(
      'protectedRoute',
      `Bearer ${tokenFor(user.id)}`,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid or expired token'),
    );
  });

  it('rejects a token whose subject is not a user id, without querying', async () => {
    const { context } = contextFor(
      'protectedRoute',
      `Bearer ${tokenFor('not-a-uuid')}`,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(findById).not.toHaveBeenCalled();
  });
});

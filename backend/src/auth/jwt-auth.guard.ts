import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { UsersService } from '../users/users.service.js';
import type { AuthenticatedRequest, JwtPayload } from './auth.types.js';
import { IS_PUBLIC_KEY } from './decorators/public.decorator.js';

const BEARER_PREFIX = 'Bearer ';

/**
 * Protects every route unless it is marked `@Public()`.
 *
 * The user is loaded on each request rather than trusted from the token, so a
 * deleted user's token stops working immediately.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith(BEARER_PREFIX)) {
      throw new UnauthorizedException('Authentication required');
    }

    const user = await this.findUser(header.slice(BEARER_PREFIX.length));
    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    request.user = {
      id: user.id,
      email: user.email,
      fullname: user.fullname,
    };
    return true;
  }

  private async findUser(token: string) {
    let payload: JwtPayload;
    try {
      // Checks the signature, the algorithm and the expiry.
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      return null;
    }
    // Guard the query: a non-UUID id would be a database error, not a miss.
    return isUUID(payload.sub) ? this.users.findById(payload.sub) : null;
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Environment } from '../config/env.validation.js';
import { UsersService } from '../users/users.service.js';
import type { JwtPayload } from './auth.types.js';
import type { LoginResponseDto } from './dto/login-response.dto.js';
import { PasswordService } from './password.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  /**
   * Exchanges credentials for an access token.
   * An unknown email and a wrong password fail identically, in both message and timing.
   */
  async login(email: string, password: string): Promise<LoginResponseDto> {
    const user = await this.users.findByEmail(email);
    // Always verify, even with no user, before deciding (see PasswordService.verify).
    const passwordMatches = await this.passwords.verify(
      password,
      user?.passwordHash,
    );
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = { sub: user.id, email: user.email };
    return {
      accessToken: await this.jwt.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: this.config.get('JWT_EXPIRES_IN', { infer: true }),
    };
  }
}

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Environment } from '../config/env.validation.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import {
  BCRYPT_ROUNDS,
  DEFAULT_BCRYPT_ROUNDS,
  PasswordService,
} from './password.service.js';

/** Login attempts allowed per client address in each one-minute window. */
export const LOGIN_ATTEMPTS_PER_MINUTE = 10;

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.get('JWT_EXPIRES_IN', { infer: true }),
        },
        // Pin the algorithm so a token signed any other way is rejected.
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
    // Applied only where a route opts in with ThrottlerGuard (the login route).
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: LOGIN_ATTEMPTS_PER_MINUTE }],
      errorMessage: 'Too many login attempts. Try again in a minute.',
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    { provide: BCRYPT_ROUNDS, useValue: DEFAULT_BCRYPT_ROUNDS },
    // Global: every route in the application requires a valid token unless @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [PasswordService],
})
export class AuthModule {}

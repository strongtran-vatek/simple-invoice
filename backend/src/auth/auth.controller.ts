import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedUser } from './auth.types.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { LoginResponseDto } from './dto/login-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { UserProfileDto } from './dto/user-profile.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  // Signing in creates nothing, so it answers 200 rather than POST's default 201.
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate with email and password',
    description:
      'Returns a JWT access token. Limited to 10 attempts a minute from one address.',
  })
  @ApiOkResponse({
    type: LoginResponseDto,
    description: 'The credentials are correct',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'The email or password is missing or malformed',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Invalid email or password',
  })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'Too many login attempts from this address',
  })
  login(@Body() credentials: LoginDto): Promise<LoginResponseDto> {
    return this.auth.login(credentials.email, credentials.password);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Return the signed-in user',
    description: 'Identifies the owner of the token. Also a way to check it.',
  })
  @ApiOkResponse({
    type: UserProfileDto,
    description: 'The user the token belongs to',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'The token is missing, invalid or expired',
  })
  me(@CurrentUser() user: AuthenticatedUser): UserProfileDto {
    return user;
  }
}

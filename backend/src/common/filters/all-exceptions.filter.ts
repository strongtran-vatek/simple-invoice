import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { STATUS_CODES } from 'node:http';

/** The single error shape every endpoint returns. */
export interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
}

/**
 * Converts anything thrown into an {@link ErrorBody}.
 * Unknown errors become a generic 500 so internal details never reach the client.
 */
export function toErrorBody(exception: unknown): ErrorBody {
  if (!(exception instanceof HttpException)) {
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    };
  }

  const statusCode = exception.getStatus();
  const response = exception.getResponse();
  const details =
    typeof response === 'object'
      ? (response as Partial<ErrorBody>)
      : { message: response };

  return {
    statusCode,
    message: details.message ?? exception.message,
    // Some libraries put an object here; `error` is always the status name.
    error:
      typeof details.error === 'string'
        ? details.error
        : (STATUS_CODES[statusCode] ?? 'Error'),
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const body = toErrorBody(exception);

    if (!(exception instanceof HttpException)) {
      // Unexpected: the stack is the only record of what went wrong.
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (body.statusCode >= 500) {
      // Raised on purpose, e.g. a failed readiness probe: one line is enough.
      this.logger.warn(`${body.statusCode} ${String(body.message)}`);
    }

    host
      .switchToHttp()
      .getResponse<Response>()
      .status(body.statusCode)
      .json(body);
  }
}

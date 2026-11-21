import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  HealthCheck,
  type HealthCheckResult,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../auth/decorators/public.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { LivenessDto, ReadinessDto } from './health.dto.js';

/**
 * Probes for whatever runs the service. Both are public: an orchestrator has
 * no token, and neither reveals more than "up" or "down".
 */
@ApiTags('health')
@Public()
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: TypeOrmHealthIndicator,
  ) {}

  /** Liveness: the process is running. It checks no dependency, on purpose. */
  @Get('health')
  @ApiOperation({
    summary: 'Is the process running?',
    description:
      'Liveness. Answers without touching the database, since restarting the API does not repair a database.',
  })
  @ApiOkResponse({ type: LivenessDto, description: 'The API is running' })
  live(): LivenessDto {
    return { status: 'ok' };
  }

  /** Readiness: the service can do its job, which needs the database. */
  @Get('ready')
  // The responses are documented below, in the API's own error shape.
  @HealthCheck({ swaggerDocumentation: false })
  @ApiOperation({
    summary: 'Can the API serve requests?',
    description:
      'Readiness. Checks that the database answers. Docker Compose waits for this before starting the frontend.',
  })
  @ApiOkResponse({
    type: ReadinessDto,
    description: 'The API and its database are up',
  })
  @ApiServiceUnavailableResponse({
    type: ErrorResponseDto,
    description: 'A dependency is down, or the API is shutting down',
  })
  async ready(): Promise<HealthCheckResult> {
    try {
      return await this.health.check([
        () => this.database.pingCheck('database'),
      ]);
    } catch (error) {
      if (!(error instanceof ServiceUnavailableException)) {
        throw error;
      }
      // Terminus reports failures in its own format. Re-state them in the one
      // error shape every endpoint of this API uses.
      const { error: failed = {} } = error.getResponse() as HealthCheckResult;
      const names = Object.keys(failed);
      throw new ServiceUnavailableException(
        names.length > 0
          ? `Not ready: ${names.join(', ')} is down`
          : 'Not ready: the API is shutting down',
      );
    }
  }
}

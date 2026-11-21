import { ApiProperty } from '@nestjs/swagger';

/** The body of `GET /health`. */
export class LivenessDto {
  @ApiProperty({ enum: ['ok'], example: 'ok' })
  status: 'ok';
}

/** The body of `GET /ready` when every dependency answers. */
export class ReadinessDto {
  @ApiProperty({ enum: ['ok'], example: 'ok' })
  status: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'The dependencies that are up',
    example: { database: { status: 'up' } },
  })
  info?: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'The dependencies that are down; empty in a 200 response',
    example: {},
  })
  error?: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Every dependency checked, with its state',
    example: { database: { status: 'up' } },
  })
  details: Record<string, unknown>;
}

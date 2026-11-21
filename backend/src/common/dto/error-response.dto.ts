import { ApiProperty } from '@nestjs/swagger';

/** Documents the error shape produced by AllExceptionsFilter. */
export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    description: 'One message, or a list of validation messages',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: ['email must be a valid email address'],
  })
  message: string | string[];

  @ApiProperty({ example: 'Bad Request' })
  error: string;
}

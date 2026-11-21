import { ApiProperty } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'reviewer@simpleinvoice.test' })
  email: string;

  @ApiProperty({ example: 'Reviewer' })
  fullname: string;
}

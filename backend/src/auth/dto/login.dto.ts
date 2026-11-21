import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'reviewer@simpleinvoice.test', maxLength: 255 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(255)
  email: string;

  // No complexity rules: the spec excludes password policies. The length cap
  // only bounds the work a single request can ask of the hash function.
  @ApiProperty({ example: 'change-me', maxLength: 128 })
  @IsString()
  @IsNotEmpty({ message: 'password must not be empty' })
  @MaxLength(128)
  password: string;
}

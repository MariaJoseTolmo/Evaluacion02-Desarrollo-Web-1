import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Profile update. Every field is optional, but changing the password requires
 * the current one — a stolen token alone must not be enough to take over an
 * account.
 */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  nombre?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  correo?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  claveNueva?: string;

  @ValidateIf((dto: UpdateUserDto) => dto.claveNueva !== undefined)
  @IsString()
  @MaxLength(72)
  claveActual?: string;
}

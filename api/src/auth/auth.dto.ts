import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Input validation happens here, at the edge. Nothing revalidates downstream. */
export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  nombre: string;

  @IsEmail()
  @MaxLength(180)
  @Transform(trimLower)
  correo: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt truncates beyond 72 bytes
  clave: string;
}

export class LoginDto {
  @IsEmail()
  @MaxLength(180)
  @Transform(trimLower)
  correo: string;

  @IsString()
  @MaxLength(72)
  clave: string;
}

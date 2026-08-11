import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { ProjectStatus } from './project.entity';

export class CreateProjectDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  nombre: string;

  @IsDateString()
  fechaInicio: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  estado?: ProjectStatus;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  responsable: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monto: number;
}

/**
 * Same rules as creation, every field optional. Derived rather than duplicated
 * so the two can never drift apart.
 */
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

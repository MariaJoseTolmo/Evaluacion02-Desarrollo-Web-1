import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { UpdateUserDto } from './user.dto';
import { config } from '../config';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    // `clave` is `select: false`, so ask for it when we may need to verify it.
    const user = await this.users.findOne({
      where: { id },
      select: { id: true, nombre: true, correo: true, clave: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (dto.claveNueva) {
      const valid = await bcrypt.compare(dto.claveActual ?? '', user.clave);
      if (!valid) throw new UnauthorizedException('La clave actual es incorrecta');
      user.clave = await bcrypt.hash(dto.claveNueva, config.bcryptRounds);
    }

    if (dto.nombre !== undefined) user.nombre = dto.nombre;
    if (dto.correo !== undefined) user.correo = dto.correo;

    try {
      await this.users.save(user);
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException('El correo ya está registrado');
      }
      throw error;
    }

    // Never hand the hash back to the client.
    const { clave: _clave, ...safe } = user;
    return safe as User;
  }
}

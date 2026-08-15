import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { User } from '../users/user.entity';
import { config } from '../config';
import { LoginDto, RegisterDto } from './auth.dto';

/** Shape returned to clients — never includes the password hash. */
export type AuthResult = {
  access_token: string;
  user: { id: number; nombre: string; correo: string };
};

const UNIQUE_VIOLATION = '23505';

/** Argon2id: memory-hard, so cracking cannot be parallelised cheaply on GPUs. */
export const ARGON2_OPTIONS = { type: argon2.argon2id, ...config.argon2 } as const;

/**
 * Compared against when the email is unknown, to keep login timing uniform.
 * Argon2 has no synchronous API, so this is a promise resolved once at startup
 * rather than a value.
 */
const dummyHash = argon2.hash('unknown-user', ARGON2_OPTIONS);

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const clave = await argon2.hash(dto.clave, ARGON2_OPTIONS);
    const user = this.users.create({ ...dto, clave });

    try {
      await this.users.save(user);
    } catch (error) {
      // Rely on the unique index rather than a check-then-insert race.
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException('El correo ya está registrado');
      }
      throw error;
    }

    return this.buildResult(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    // `clave` is `select: false` on the entity, so ask for it explicitly.
    const user = await this.users.findOne({
      where: { correo: dto.correo },
      select: { id: true, nombre: true, correo: true, clave: true },
    });

    // Ojo con el orden: argon2.verify recibe (hash, claveEnClaro), al revés que
    // bcrypt.compare(claveEnClaro, hash). Invertirlo hace que todo login falle.
    const valid = await argon2.verify(user?.clave ?? (await dummyHash), dto.clave);
    if (!user || !valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.buildResult(user);
  }

  /** Current user for a verified token. `clave` stays excluded by default. */
  async findById(id: number): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    return user;
  }

  private async buildResult(user: User): Promise<AuthResult> {
    const access_token = await this.jwt.signAsync({
      sub: user.id,
      correo: user.correo,
    });
    return {
      access_token,
      user: { id: user.id, nombre: user.nombre, correo: user.correo },
    };
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export type AuthUser = { id: number; correo: string };

/** Request augmented by this guard once the token is verified. */
export type AuthedRequest = Request & { user: AuthUser };

/**
 * Rejects any request without a valid `Authorization: Bearer <jwt>` header and
 * attaches the decoded user to the request for downstream handlers.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: number; correo: string }>(
        token,
      );
      request.user = { id: payload.sub, correo: payload.correo };
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}

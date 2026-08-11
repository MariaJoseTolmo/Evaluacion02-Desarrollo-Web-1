import { Body, Controller, Patch, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './user.dto';
import { AuthedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /**
   * Users edit only themselves — the id comes from the verified token, never
   * from the URL, so there is no way to target another account.
   */
  @Patch('me')
  update(@Req() req: AuthedRequest, @Body() dto: UpdateUserDto) {
    return this.users.update(req.user.id, dto);
  }
}

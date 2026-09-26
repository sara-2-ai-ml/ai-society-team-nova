import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './jwt-payload';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = this.users.findByUsername(username);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Përdoruesi ose fjalëkalimi është i gabuar');
    }

    const payload: JwtPayload = { sub: user.id, username: user.username, role: user.role, unitId: user.unitId };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: this.users.toPublic(user),
    };
  }

  me(userId: number) {
    const user = this.users.findById(userId);
    if (!user) throw new NotFoundException();
    return this.users.toPublic(user);
  }

  /** Seeded accounts for the sign-in screen's quick pick (usernames only, never passwords). */
  demoAccounts() {
    return this.users.findAll().map(({ username, fullName, fullNameEn, role, unitId }) => ({ username, fullName, fullNameEn, role, unitId }));
  }
}

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { Role } from '../auth/role.enum';
import { MOCK_UNITS } from '../units/units.mock';
import { PublicUser, User } from './user.entity';

// In-memory store until a database is added: the operator, the mayor, and one account per unit.
const SEED_USERS: Omit<User, 'id' | 'passwordHash'>[] = [
  { username: 'operator', fullName: 'Operatori i Protokollit', fullNameEn: 'Protocol Operator', role: Role.Operator, unitId: null },
  { username: 'kryetari', fullName: 'Kryetari i Bashkisë', fullNameEn: 'Mayor', role: Role.Kryetari, unitId: null },
  ...MOCK_UNITS.map((unit) => ({
    username: `${unit.type === 'agjenci' ? 'agjencia' : 'drejtoria'}.${unit.id}`,
    fullName: unit.name,
    fullNameEn: unit.nameEn,
    role: Role.Drejtoria,
    unitId: unit.id,
  })),
];

@Injectable()
export class UsersService implements OnModuleInit {
  private users: User[] = [];

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const password = this.config.get<string>('SEED_PASSWORD');
    if (!password) return;

    const passwordHash = await bcrypt.hash(password, 10);
    this.users = SEED_USERS.map((u, i) => ({ ...u, id: i + 1, passwordHash }));
  }

  findAll(): User[] {
    return this.users;
  }

  findByUsername(username: string): User | undefined {
    return this.users.find((u) => u.username === username.toLowerCase());
  }

  findById(id: number): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  toPublic({ passwordHash, ...user }: User): PublicUser {
    return user;
  }
}

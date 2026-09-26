import { Role } from './role.enum';

export interface JwtPayload {
  sub: number;
  username: string;
  role: Role;
  unitId: string | null;
}

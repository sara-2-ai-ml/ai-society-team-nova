import { Role } from '../auth/role.enum';

export interface User {
  id: number;
  username: string;
  fullName: string;
  fullNameEn: string;
  passwordHash: string;
  role: Role;
  /** The drejtori/agjenci a DREJTORIA user works in; null for other roles. */
  unitId: string | null;
}

export type PublicUser = Omit<User, 'passwordHash'>;

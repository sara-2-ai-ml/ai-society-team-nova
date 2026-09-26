import { SetMetadata } from '@nestjs/common';
import { Role } from '../role.enum';

export const ROLES_KEY = 'roles';

/** Restricts a route or controller to the given roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../role.enum';
import { RolesGuard } from './roles.guard';

function contextFor(user?: { role: Role }): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  it('allows any user when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(contextFor({ role: Role.Operator }))).toBe(true);
  });

  it('allows a user with a required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.Drejtoria, Role.Kryetari]);
    expect(guard.canActivate(contextFor({ role: Role.Kryetari }))).toBe(true);
  });

  it('rejects a user without a required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.Kryetari]);
    expect(guard.canActivate(contextFor({ role: Role.Operator }))).toBe(false);
  });
});

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { UserRole } from '../constants';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { fail } from '../http-response';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      fail('Authentication required', 'authentication_required', 401);
    }
    if (!requiredRoles.includes(request.user.role as UserRole)) {
      fail('Unauthorized access', 'unauthorized', 403);
    }
    return true;
  }
}

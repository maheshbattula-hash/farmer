import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { AuthToken } from '../../auth/schemas/auth-token.schema';
import { User } from '../../auth/schemas/user.schema';
import { fail } from '../http-response';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class TokenAuthGuard implements CanActivate {
  constructor(
    @InjectModel(AuthToken.name) private readonly authTokenModel: Model<AuthToken>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization || '';
    const [scheme, token] = authorization.trim().split(/\s+/, 2);

    if (scheme !== 'Token' || !token) {
      fail('Authentication credentials were not provided.', 'not_authenticated', 401);
    }

    const authToken = await this.authTokenModel.findOne({ key: token }).lean();
    if (!authToken) {
      fail('Invalid or expired token.', 'invalid_token', 401);
    }

    const user = await this.userModel.findById(authToken.user);
    if (!user) {
      fail('Invalid or expired token.', 'invalid_token', 401);
    }

    request.user = user as any;
    request.tokenKey = token;
    return true;
  }
}

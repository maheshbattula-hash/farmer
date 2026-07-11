import type { HydratedDocument } from 'mongoose';

import type { User } from '../../auth/schemas/user.schema';

export interface AuthenticatedRequest {
  headers: Record<string, string | undefined>;
  user?: HydratedDocument<User>;
  tokenKey?: string;
  [key: string]: any;
}

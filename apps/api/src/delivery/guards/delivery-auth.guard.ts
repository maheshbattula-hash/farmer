import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { createHmac } from 'node:crypto';

import { DeliveryBoy, type DeliveryBoyDocument } from '../schemas/delivery-boy.schema';
import { fail } from '../../common/http-response';
import { env } from '../../common/utils/env';

export interface AuthenticatedDeliveryRequest extends Request {
  deliveryBoy?: DeliveryBoyDocument;
  user?: any;
}

const JWT_SECRET = process.env.JWT_SECRET || 'smart_farmer_delivery_jwt_secret_key_2026';

export function generateJwtToken(payload: Record<string, unknown>): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const base64UrlHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const base64UrlPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const signature = createHmac('sha256', JWT_SECRET)
    .update(`${base64UrlHeader}.${base64UrlPayload}`)
    .digest('base64url');
    
  return `${base64UrlHeader}.${base64UrlPayload}.${signature}`;
}

export function verifyJwtToken(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    
    const expectedSig = createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    if (expectedSig !== signatureB64) {
      return null;
    }

    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}

@Injectable()
export class DeliveryAuthGuard implements CanActivate {
  constructor(
    @InjectModel(DeliveryBoy.name) private readonly deliveryBoyModel: Model<DeliveryBoy>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedDeliveryRequest>();
    const reqAny = request as any;
    const headers = reqAny.headers || {};
    const authorization = String(headers['authorization'] || headers['Authorization'] || '');
    
    if (!authorization) {
      fail('Authorization header missing.', 'unauthorized', 401);
    }

    const [scheme, token] = authorization.trim().split(/\s+/, 2);

    if ((scheme !== 'Bearer' && scheme !== 'Token') || !token) {
      fail('Invalid or missing authentication token format.', 'unauthorized', 401);
    }

    const decoded = verifyJwtToken(token);
    if (!decoded || !decoded.sub) {
      fail('Invalid or expired token.', 'unauthorized', 401);
    }

    const deliveryBoy = await this.deliveryBoyModel.findById(decoded.sub);
    if (!deliveryBoy) {
      fail('Delivery boy account not found or unauthorized.', 'unauthorized', 401);
    }

    request.deliveryBoy = deliveryBoy as any;
    request.user = deliveryBoy as any;
    return true;
  }
}

import { HttpException, HttpStatus } from '@nestjs/common';

export type AppPayload = Record<string, unknown> & {
  success: boolean;
  message: string;
  error_code: string | null;
};

export function ok(message: string, extra: Record<string, unknown> = {}): AppPayload {
  return {
    success: true,
    message,
    error_code: null,
    ...extra,
  };
}

export function err(message: string, errorCode: string, extra: Record<string, unknown> = {}): AppPayload {
  return {
    success: false,
    message,
    error_code: errorCode,
    ...extra,
  };
}

export function fail(
  message: string,
  errorCode: string,
  status = HttpStatus.BAD_REQUEST,
  extra: Record<string, unknown> = {},
): never {
  throw new HttpException(err(message, errorCode, extra), status);
}

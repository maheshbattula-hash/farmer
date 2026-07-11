import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

import { err } from '../http-response';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<any>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (payload && typeof payload === 'object' && 'success' in payload) {
        response.status(status).json(payload);
        return;
      }
      const message = this.extractMessage(payload) || 'Request failed';
      response.status(status).json(err(message, 'request_failed'));
      return;
    }

    console.error(exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(err('Internal server error', 'internal_error'));
  }

  private extractMessage(payload: unknown): string | null {
    if (typeof payload === 'string') {
      return payload;
    }
    if (payload && typeof payload === 'object' && 'message' in payload) {
      const message = (payload as { message?: unknown }).message;
      if (Array.isArray(message)) {
        return message.map((item) => String(item)).join(', ');
      }
      if (typeof message === 'string') {
        return message;
      }
    }
    return null;
  }
}

import { Controller, Get, Req } from '@nestjs/common';

@Controller()
export class RootController {
  @Get()
  index(@Req() request: any) {
    const protocol = String(request.headers['x-forwarded-proto'] || request.protocol || 'http');
    const host = request.get('host') || 'localhost:8000';
    const baseUrl = `${protocol}://${host}`;

    return {
      name: 'Smart Farmer API',
      status: 'ok',
      endpoints: {
        health: `${baseUrl}/health`,
        auth: `${baseUrl}/api/auth`,
        marketplace: `${baseUrl}/api/marketplace`,
        orders: `${baseUrl}/api/orders`,
        reviews: `${baseUrl}/api/reviews`,
      },
    };
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { DeliveryService } from './delivery.service';
import { DeliveryAuthGuard, type AuthenticatedDeliveryRequest } from './guards/delivery-auth.guard';

@Controller('api')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post('delivery/auth/register')
  @HttpCode(201)
  register(@Body() body: Record<string, unknown>) {
    return this.deliveryService.register(body);
  }

  @Post('delivery/auth/login')
  @HttpCode(200)
  login(@Body() body: Record<string, unknown>) {
    return this.deliveryService.login(body);
  }

  @UseGuards(DeliveryAuthGuard)
  @Post('delivery/location')
  @HttpCode(200)
  updateLocation(@Req() req: AuthenticatedDeliveryRequest, @Body() body: Record<string, unknown>) {
    return this.deliveryService.updateLocation(req.deliveryBoy!, body);
  }

  @Get('delivery/nearby')
  findNearbyDeliveryBoys(@Query() query: Record<string, unknown>) {
    return this.deliveryService.findNearbyDeliveryBoys(query);
  }

  @Post('orders')
  @HttpCode(201)
  createOrder(@Body() body: Record<string, unknown>) {
    return this.deliveryService.createOrder(body);
  }

  @UseGuards(DeliveryAuthGuard)
  @Get('delivery/orders/nearby')
  getNearbyOrders(@Req() req: AuthenticatedDeliveryRequest) {
    return this.deliveryService.getNearbyOrdersForDeliveryBoy(req.deliveryBoy!);
  }

  @UseGuards(DeliveryAuthGuard)
  @Post('delivery/orders/:orderId/accept')
  @HttpCode(200)
  acceptOrder(@Req() req: AuthenticatedDeliveryRequest, @Param('orderId') orderId: string) {
    return this.deliveryService.acceptOrder(req.deliveryBoy!, orderId);
  }

  @UseGuards(DeliveryAuthGuard)
  @Post('delivery/orders/:orderId/reject')
  @HttpCode(200)
  rejectOrder(@Req() req: AuthenticatedDeliveryRequest, @Param('orderId') orderId: string) {
    return this.deliveryService.rejectOrder(req.deliveryBoy!, orderId);
  }

  @Get('orders/:orderId/tracking')
  getOrderTracking(@Param('orderId') orderId: string) {
    return this.deliveryService.getOrderTracking(orderId);
  }
}

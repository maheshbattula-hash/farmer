import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';

import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TokenAuthGuard } from '../common/guards/token-auth.guard';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

import { OrdersService } from './orders.service';

@Controller('api/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @UseGuards(TokenAuthGuard, RolesGuard)
  @Roles('customer')
  @Post('place')
  placeOrder(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.ordersService.placeOrder(request.user!, body);
  }

  @UseGuards(TokenAuthGuard, RolesGuard)
  @Roles('customer')
  @Get('my')
  myOrders(@Req() request: AuthenticatedRequest) {
    return this.ordersService.myOrders(request.user!);
  }

  @UseGuards(TokenAuthGuard, RolesGuard)
  @Roles('customer')
  @Post('confirm-payment')
  confirmPayment(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.ordersService.confirmPayment(request.user!, body);
  }

  @UseGuards(TokenAuthGuard, RolesGuard)
  @Roles('farmer')
  @Post('farmer/update-status')
  farmerUpdateOrder(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.ordersService.farmerUpdateOrder(request.user!, body);
  }

  @UseGuards(TokenAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/dashboard')
  adminDashboard() {
    return this.ordersService.adminDashboard();
  }

  @UseGuards(TokenAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('admin/orders/:orderId/status')
  adminUpdateOrder(@Param('orderId') orderId: string, @Body() body: Record<string, unknown>) {
    return this.ordersService.adminUpdateOrder(orderId, body);
  }

  @UseGuards(TokenAuthGuard, RolesGuard)
  @Roles('customer', 'farmer', 'admin')
  @Get(':orderId/invoice')
  invoiceForUser(@Req() request: AuthenticatedRequest, @Param('orderId') orderId: string) {
    return this.ordersService.invoiceForUser(request.user!, orderId);
  }

  @UseGuards(TokenAuthGuard, RolesGuard)
  @Roles('customer')
  @Get(':orderId')
  orderDetail(@Req() request: AuthenticatedRequest, @Param('orderId') orderId: string) {
    return this.ordersService.orderDetail(request.user!, orderId);
  }

  @UseGuards(TokenAuthGuard, RolesGuard)
  @Roles('customer')
  @Post(':orderId/cancel')
  cancelOrder(@Req() request: AuthenticatedRequest, @Param('orderId') orderId: string) {
    return this.ordersService.cancelOrder(request.user!, orderId);
  }
}

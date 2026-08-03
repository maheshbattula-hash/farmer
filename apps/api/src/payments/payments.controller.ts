import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';

import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TokenAuthGuard } from '../common/guards/token-auth.guard';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

import { PaymentsService } from './payments.service';

@Controller('api/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(TokenAuthGuard, RolesGuard)
  @Roles('customer')
  @Post('create-order')
  createRazorpayOrder(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.paymentsService.createRazorpayOrder(request.user!, body);
  }

  @UseGuards(TokenAuthGuard, RolesGuard)
  @Roles('customer')
  @Post('verify')
  verifyRazorpayPayment(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.paymentsService.verifyRazorpayPayment(request.user!, body);
  }

  @UseGuards(TokenAuthGuard, RolesGuard)
  @Roles('customer')
  @Get(':orderId/status')
  getPaymentStatus(@Req() request: AuthenticatedRequest, @Param('orderId') orderId: string) {
    return this.paymentsService.getPaymentStatus(request.user!, orderId);
  }
}

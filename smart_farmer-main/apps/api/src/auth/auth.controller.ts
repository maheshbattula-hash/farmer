import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';

import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TokenAuthGuard } from '../common/guards/token-auth.guard';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

import { AuthService } from './auth.service';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: Record<string, unknown>) {
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body() body: Record<string, unknown>) {
    return this.authService.login(body);
  }

  @Post('email-verification/start')
  startEmailVerification(@Body() body: Record<string, unknown>) {
    return this.authService.startEmailVerification(body);
  }

  @Post('login-after-email-verification')
  loginAfterEmailVerification(@Body() body: Record<string, unknown>) {
    return this.authService.loginAfterEmailVerification(body);
  }

  @Post('request-otp')
  requestOtp(@Body() body: Record<string, unknown>) {
    return this.authService.requestOtp(body);
  }

  @Post('verify-otp')
  verifyOtp(@Body() body: Record<string, unknown>) {
    return this.authService.verifyOtp(body);
  }

  @Post('forgot-password')
  forgotPassword(@Body() body: Record<string, unknown>) {
    return this.authService.forgotPassword(body);
  }

  @Post('reset-password')
  resetPassword(@Body() body: Record<string, unknown>) {
    return this.authService.resetPassword(body);
  }

  @Post('admin/login')
  adminLogin(@Body() body: Record<string, unknown>) {
    return this.authService.adminLogin(body);
  }

  @UseGuards(TokenAuthGuard)
  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.me(request.user!);
  }

  @UseGuards(TokenAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('admin/users/:userId/toggle-verification')
  toggleVerification(@Param('userId') userId: string) {
    return this.authService.toggleVerification(userId);
  }

  @UseGuards(TokenAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete('admin/users/:userId')
  deleteUser(@Param('userId') userId: string) {
    return this.authService.deleteUser(userId);
  }
}

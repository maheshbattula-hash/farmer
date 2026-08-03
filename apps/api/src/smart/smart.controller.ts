import { Body, Controller, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { TokenAuthGuard } from '../common/guards/token-auth.guard';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { cropUploadOptions } from '../marketplace/upload.config';

import { SmartService } from './smart.service';

@Controller('api/smart')
export class SmartController {
  constructor(private readonly smartService: SmartService) {}

  @UseGuards(TokenAuthGuard)
  @Get('overview')
  overview(@Req() request: AuthenticatedRequest) {
    return this.smartService.overview(request.user!);
  }

  @UseGuards(TokenAuthGuard)
  @Get('analytics')
  analytics(@Req() request: AuthenticatedRequest) {
    return this.smartService.analytics(request.user!);
  }

  @UseGuards(TokenAuthGuard)
  @Get('forecast')
  forecast(@Req() request: AuthenticatedRequest, @Query() query: Record<string, unknown>) {
    return this.smartService.marketForecast(request.user!, query);
  }

  @UseGuards(TokenAuthGuard)
  @Get('advisory')
  advisory(@Req() request: AuthenticatedRequest, @Query() query: Record<string, unknown>) {
    return this.smartService.advisory(request.user!, query);
  }

  @UseGuards(TokenAuthGuard)
  @Get('notifications')
  notifications(@Req() request: AuthenticatedRequest) {
    return this.smartService.notifications(request.user!);
  }

  @UseGuards(TokenAuthGuard)
  @Patch('notifications/:notificationId/read')
  markRead(@Req() request: AuthenticatedRequest, @Param('notificationId') notificationId: string) {
    return this.smartService.markNotificationRead(request.user!, notificationId);
  }

  @UseGuards(TokenAuthGuard)
  @Post('push-token')
  pushToken(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.smartService.registerPushToken(request.user!, body);
  }

  @UseGuards(TokenAuthGuard)
  @Post('location')
  updateLocation(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.smartService.updateLocation(request.user!, body);
  }

  @UseGuards(TokenAuthGuard)
  @Post('disease/predict')
  @UseInterceptors(FileInterceptor('image', cropUploadOptions))
  diseasePredict(
    @Req() request: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
    @UploadedFile() file?: any,
  ) {
    return this.smartService.diseasePredict(request.user!, body, file);
  }

  @UseGuards(TokenAuthGuard)
  @Post('irrigation/recommend')
  irrigationRecommend(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.smartService.irrigationRecommend(request.user!, body);
  }
}

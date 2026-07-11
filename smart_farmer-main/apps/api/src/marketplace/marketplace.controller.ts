import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TokenAuthGuard } from '../common/guards/token-auth.guard';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

import { MarketplaceService } from './marketplace.service';
import { cropUploadOptions } from './upload.config';

@Controller('api/marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @UseGuards(TokenAuthGuard)
  @Get('crops')
  listCrops(@Query() query: Record<string, unknown>) {
    return this.marketplaceService.listCrops(query);
  }

  @Get('farmers/:farmerId/profile')
  farmerProfile(@Param('farmerId') farmerId: string) {
    return this.marketplaceService.farmerProfile(farmerId);
  }

  @UseGuards(TokenAuthGuard, RolesGuard)
  @Roles('farmer')
  @Get('farmer/dashboard')
  farmerDashboard(@Req() request: AuthenticatedRequest) {
    return this.marketplaceService.farmerDashboard(request.user!);
  }

  @UseGuards(TokenAuthGuard, RolesGuard)
  @Roles('farmer')
  @Post('farmer/crops')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'image', maxCount: 1 },
        { name: 'quality_proof', maxCount: 1 },
      ],
      cropUploadOptions,
    ),
  )
  createCrop(
    @Req() request: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files: { image?: any[]; quality_proof?: any[] },
  ) {
    return this.marketplaceService.createCrop(request.user!, body, files || {});
  }

  @UseGuards(TokenAuthGuard)
  @Get('farmer/crops/:cropId')
  cropDetail(@Req() request: AuthenticatedRequest, @Param('cropId') cropId: string) {
    return this.marketplaceService.cropDetail(request.user!, cropId);
  }

  @UseGuards(TokenAuthGuard)
  @Patch('farmer/crops/:cropId')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'image', maxCount: 1 },
        { name: 'quality_proof', maxCount: 1 },
      ],
      cropUploadOptions,
    ),
  )
  updateCrop(
    @Req() request: AuthenticatedRequest,
    @Param('cropId') cropId: string,
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files: { image?: any[]; quality_proof?: any[] },
  ) {
    return this.marketplaceService.updateCrop(request.user!, cropId, body, files || {});
  }

  @UseGuards(TokenAuthGuard)
  @Delete('farmer/crops/:cropId')
  deleteCrop(@Req() request: AuthenticatedRequest, @Param('cropId') cropId: string) {
    return this.marketplaceService.deleteCrop(request.user!, cropId);
  }
}

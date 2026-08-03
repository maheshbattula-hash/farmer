import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';

import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TokenAuthGuard } from '../common/guards/token-auth.guard';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

import { ReviewsService } from './reviews.service';

@Controller('api/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @UseGuards(TokenAuthGuard, RolesGuard)
  @Roles('customer')
  @Post('submit')
  submitReview(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.reviewsService.submitReview(request.user!, body);
  }
}

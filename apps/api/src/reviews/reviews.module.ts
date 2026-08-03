import { Module } from '@nestjs/common';

import { RolesGuard } from '../common/guards/roles.guard';
import { TokenAuthGuard } from '../common/guards/token-auth.guard';
import { DatabaseModelsModule } from '../common/schemas/database-models.module';

import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [DatabaseModelsModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, TokenAuthGuard, RolesGuard],
})
export class ReviewsModule {}

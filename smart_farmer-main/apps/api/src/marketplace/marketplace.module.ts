import { Module } from '@nestjs/common';

import { RolesGuard } from '../common/guards/roles.guard';
import { TokenAuthGuard } from '../common/guards/token-auth.guard';
import { DatabaseModelsModule } from '../common/schemas/database-models.module';

import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

@Module({
  imports: [DatabaseModelsModule],
  controllers: [MarketplaceController],
  providers: [MarketplaceService, TokenAuthGuard, RolesGuard],
})
export class MarketplaceModule {}

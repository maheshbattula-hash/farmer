import { Module } from '@nestjs/common';

import { TokenAuthGuard } from '../common/guards/token-auth.guard';
import { DatabaseModelsModule } from '../common/schemas/database-models.module';

import { SmartController } from './smart.controller';
import { SmartService } from './smart.service';

@Module({
  imports: [DatabaseModelsModule],
  controllers: [SmartController],
  providers: [SmartService, TokenAuthGuard],
  exports: [SmartService],
})
export class SmartModule {}

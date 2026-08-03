import { Module } from '@nestjs/common';

import { RolesGuard } from '../common/guards/roles.guard';
import { TokenAuthGuard } from '../common/guards/token-auth.guard';
import { DatabaseModelsModule } from '../common/schemas/database-models.module';

import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [DatabaseModelsModule],
  controllers: [OrdersController],
  providers: [OrdersService, TokenAuthGuard, RolesGuard],
  exports: [OrdersService],
})
export class OrdersModule {}

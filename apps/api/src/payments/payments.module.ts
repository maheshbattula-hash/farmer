import { Module } from '@nestjs/common';

import { RolesGuard } from '../common/guards/roles.guard';
import { TokenAuthGuard } from '../common/guards/token-auth.guard';
import { DatabaseModelsModule } from '../common/schemas/database-models.module';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [DatabaseModelsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, TokenAuthGuard, RolesGuard],
  exports: [PaymentsService],
})
export class PaymentsModule {}

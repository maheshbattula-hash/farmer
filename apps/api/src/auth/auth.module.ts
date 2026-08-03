import { Module } from '@nestjs/common';

import { RolesGuard } from '../common/guards/roles.guard';
import { TokenAuthGuard } from '../common/guards/token-auth.guard';
import { DatabaseModelsModule } from '../common/schemas/database-models.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [DatabaseModelsModule],
  controllers: [AuthController],
  providers: [AuthService, TokenAuthGuard, RolesGuard],
  exports: [AuthService],
})
export class AuthModule {}

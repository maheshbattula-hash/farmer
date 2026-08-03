import { Module } from '@nestjs/common';

import { TokenAuthGuard } from '../common/guards/token-auth.guard';
import { DatabaseModelsModule } from '../common/schemas/database-models.module';

import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [DatabaseModelsModule],
  controllers: [ChatController],
  providers: [ChatService, TokenAuthGuard],
  exports: [ChatService],
})
export class ChatModule {}

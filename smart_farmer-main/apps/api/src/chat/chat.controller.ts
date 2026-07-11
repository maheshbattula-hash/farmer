import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';

import { TokenAuthGuard } from '../common/guards/token-auth.guard';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

import { ChatService } from './chat.service';

@Controller('api/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @UseGuards(TokenAuthGuard)
  @Get('inbox')
  inbox(@Req() request: AuthenticatedRequest) {
    return this.chatService.inbox(request.user!);
  }

  @UseGuards(TokenAuthGuard)
  @Post('start/:cropId')
  start(@Req() request: AuthenticatedRequest, @Param('cropId') cropId: string) {
    return this.chatService.openThreadFromCrop(request.user!, cropId);
  }

  @UseGuards(TokenAuthGuard)
  @Get('thread/:threadId')
  detail(@Req() request: AuthenticatedRequest, @Param('threadId') threadId: string) {
    return this.chatService.threadDetail(request.user!, threadId);
  }

  @UseGuards(TokenAuthGuard)
  @Post('thread/:threadId/messages')
  send(@Req() request: AuthenticatedRequest, @Param('threadId') threadId: string, @Body() body: Record<string, unknown>) {
    return this.chatService.sendMessage(request.user!, threadId, body);
  }
}

import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ok, fail } from '../common/http-response';
import { serializeUser } from '../common/serializers';
import { asIdString, isValidObjectId } from '../common/utils/ids';
import { Crop } from '../marketplace/schemas/crop.schema';
import { Notification } from '../smart/schemas/notification.schema';

import { ChatMessage } from './schemas/chat-message.schema';
import { ChatThread } from './schemas/chat-thread.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatThread.name) private readonly chatThreadModel: Model<ChatThread>,
    @InjectModel(ChatMessage.name) private readonly chatMessageModel: Model<ChatMessage>,
    @InjectModel(Crop.name) private readonly cropModel: Model<Crop>,
    @InjectModel(Notification.name) private readonly notificationModel: Model<Notification>,
  ) {}

  async inbox(user: any) {
    const threads = await this.chatThreadModel
      .find({ $or: [{ buyer: user._id }, { farmer: user._id }] })
      .sort({ last_message_at: -1 })
      .populate('crop')
      .populate('farmer')
      .populate('buyer');

    const threadIds = threads.map((thread: any) => thread._id);
    const unreadMessages = threadIds.length
      ? await this.chatMessageModel.find({ thread: { $in: threadIds }, sender: { $ne: user._id }, read_at: null }).lean()
      : [];
    const unreadMap = new Map<string, number>();
    unreadMessages.forEach((message: any) => {
      const key = asIdString(message.thread);
      unreadMap.set(key, (unreadMap.get(key) || 0) + 1);
    });

    const serialized = threads.map((thread: any) => this.serializeThread(thread, user, unreadMap.get(asIdString(thread._id)) || 0));
    return ok('Chat inbox loaded', {
      threads: serialized,
      unread_total: serialized.reduce((sum: number, item: any) => sum + Number(item.unread_count || 0), 0),
    });
  }

  async openThreadFromCrop(user: any, cropId: string) {
    if (!isValidObjectId(cropId)) {
      fail('Crop not found', 'crop_not_found', HttpStatus.NOT_FOUND);
    }
    const crop: any = await this.cropModel.findById(cropId).populate('farmer');
    if (!crop) {
      fail('Crop not found', 'crop_not_found', HttpStatus.NOT_FOUND);
    }
    const farmerId = asIdString(crop.farmer?._id || crop.farmer);
    if (farmerId === asIdString(user._id)) {
      fail('You cannot open a buyer chat for your own listing.', 'invalid_chat_request');
    }

    let thread: any = await this.chatThreadModel
      .findOne({ crop: crop._id, buyer: user._id })
      .populate('crop')
      .populate('farmer')
      .populate('buyer');

    if (!thread) {
      thread = await this.chatThreadModel.create({
        crop: crop._id,
        farmer: crop.farmer?._id || crop.farmer,
        buyer: user._id,
        last_message: '',
        last_message_at: new Date(),
      });
      thread = await this.chatThreadModel
        .findById(thread._id)
        .populate('crop')
        .populate('farmer')
        .populate('buyer');
    }

    return ok('Chat thread ready', {
      thread: this.serializeThread(thread, user, 0),
    });
  }

  async threadDetail(user: any, threadId: string) {
    const thread = await this.findThreadForUser(threadId, user);
    if (!thread) {
      fail('Chat thread not found', 'thread_not_found', HttpStatus.NOT_FOUND);
    }

    await this.chatMessageModel.updateMany(
      { thread: thread._id, sender: { $ne: user._id }, read_at: null },
      { $set: { read_at: new Date() } },
    );

    const messages = await this.chatMessageModel.find({ thread: thread._id }).sort({ created_at: 1 }).populate('sender');

    return ok('Thread loaded', {
      thread: this.serializeThread(thread, user, 0),
      messages: messages.map((message: any) => this.serializeMessage(message, user)),
    });
  }

  async sendMessage(user: any, threadId: string, body: Record<string, unknown>) {
    const thread = await this.findThreadForUser(threadId, user);
    if (!thread) {
      fail('Chat thread not found', 'thread_not_found', HttpStatus.NOT_FOUND);
    }

    const messageBody = String(body.body || '').trim();
    const attachmentName = String(body.attachment_name || '').trim();
    if (!messageBody && !attachmentName) {
      fail('Message body is required.', 'message_required');
    }

    const message: any = await this.chatMessageModel.create({
      thread: thread._id,
      sender: user._id,
      body: messageBody,
      attachment_name: attachmentName,
    });

    thread.last_message = messageBody || attachmentName || 'Attachment sent';
    thread.last_message_at = new Date();
    thread.last_sender = user._id;
    await thread.save();

    const counterpartId = asIdString(thread.buyer?._id || thread.buyer) === asIdString(user._id)
      ? (thread.farmer?._id || thread.farmer)
      : (thread.buyer?._id || thread.buyer);

    await this.notificationModel.create({
      user: counterpartId,
      title: 'New chat message',
      body: `${user.full_name || user.username} sent a message about ${thread.crop?.name || 'a listing'}.`,
      category: 'chat',
      meta: {
        thread_id: asIdString(thread._id),
        crop_id: asIdString(thread.crop?._id || thread.crop),
      },
    });

    const populatedMessage = await this.chatMessageModel.findById(message._id).populate('sender');
    return ok('Message sent', {
      message: this.serializeMessage(populatedMessage || message, user),
    });
  }

  private async findThreadForUser(threadId: string, user: any) {
    if (!isValidObjectId(threadId)) {
      return null;
    }
    const thread: any = await this.chatThreadModel
      .findById(threadId)
      .populate('crop')
      .populate('farmer')
      .populate('buyer');
    if (!thread) {
      return null;
    }
    const userId = asIdString(user._id);
    const farmerId = asIdString(thread.farmer?._id || thread.farmer);
    const buyerId = asIdString(thread.buyer?._id || thread.buyer);
    return farmerId === userId || buyerId === userId ? thread : null;
  }

  private serializeThread(thread: any, user: any, unreadCount: number) {
    const userId = asIdString(user._id);
    const isBuyer = asIdString(thread.buyer?._id || thread.buyer) === userId;
    const counterpart = isBuyer ? thread.farmer : thread.buyer;
    const crop = thread.crop || {};
    return {
      id: asIdString(thread._id),
      crop_id: asIdString(crop._id || thread.crop),
      crop_name: crop.name || '',
      counterpart_name: counterpart?.full_name || counterpart?.username || '',
      counterpart_role: counterpart?.role || '',
      counterpart: serializeUser(counterpart || {}),
      last_message: thread.last_message || '',
      last_message_at: thread.last_message_at || null,
      last_message_at_display: thread.last_message_at ? new Date(thread.last_message_at).toISOString().slice(0, 16).replace('T', ' ') : '',
      unread_count: unreadCount,
    };
  }

  private serializeMessage(message: any, user: any) {
    const sender = message.sender || {};
    return {
      id: asIdString(message._id),
      sender_id: asIdString(sender._id || message.sender),
      sender_name: sender.full_name || sender.username || '',
      body: message.body || '',
      attachment_name: message.attachment_name || '',
      created_at: message.created_at || null,
      created_at_display: message.created_at ? new Date(message.created_at).toISOString().slice(0, 16).replace('T', ' ') : '',
      is_mine: asIdString(sender._id || message.sender) === asIdString(user._id),
    };
  }
}

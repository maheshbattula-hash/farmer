import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthChallenge, AuthChallengeSchema } from '../../auth/schemas/auth-challenge.schema';
import { AuthToken, AuthTokenSchema } from '../../auth/schemas/auth-token.schema';
import { OtpRequest, OtpRequestSchema } from '../../auth/schemas/otp-request.schema';
import { User, UserSchema } from '../../auth/schemas/user.schema';
import { ChatMessage, ChatMessageSchema } from '../../chat/schemas/chat-message.schema';
import { ChatThread, ChatThreadSchema } from '../../chat/schemas/chat-thread.schema';
import { Crop, CropSchema } from '../../marketplace/schemas/crop.schema';
import { Order, OrderSchema } from '../../orders/schemas/order.schema';
import { OrderUpdate, OrderUpdateSchema } from '../../orders/schemas/order-update.schema';
import { Review, ReviewSchema } from '../../reviews/schemas/review.schema';
import { DiseaseReport, DiseaseReportSchema } from '../../smart/schemas/disease-report.schema';
import { IrrigationPlan, IrrigationPlanSchema } from '../../smart/schemas/irrigation-plan.schema';
import { Notification, NotificationSchema } from '../../smart/schemas/notification.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: AuthChallenge.name, schema: AuthChallengeSchema },
      { name: OtpRequest.name, schema: OtpRequestSchema },
      { name: AuthToken.name, schema: AuthTokenSchema },
      { name: Crop.name, schema: CropSchema },
      { name: Order.name, schema: OrderSchema },
      { name: OrderUpdate.name, schema: OrderUpdateSchema },
      { name: Review.name, schema: ReviewSchema },
      { name: ChatThread.name, schema: ChatThreadSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: DiseaseReport.name, schema: DiseaseReportSchema },
      { name: IrrigationPlan.name, schema: IrrigationPlanSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class DatabaseModelsModule {}

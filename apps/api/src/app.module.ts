import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { env } from './common/utils/env';
import { DeliveryModule } from './delivery/delivery.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { ReviewsModule } from './reviews/reviews.module';
import { RootModule } from './root/root.module';
import { SmartModule } from './smart/smart.module';

@Module({
  imports: [
    MongooseModule.forRoot(env.mongodbUri, {
      dbName: env.mongodbName,
    }),
    RootModule,
    AuthModule,
    DeliveryModule,
    MarketplaceModule,
    OrdersModule,
    PaymentsModule,
    ReviewsModule,
    ChatModule,
    SmartModule,
  ],
})
export class AppModule {}

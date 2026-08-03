import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { DeliveryAuthGuard } from './guards/delivery-auth.guard';
import { DeliveryBoy, DeliveryBoySchema } from './schemas/delivery-boy.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DeliveryBoy.name, schema: DeliveryBoySchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [DeliveryController],
  providers: [DeliveryService, DeliveryAuthGuard],
  exports: [DeliveryService],
})
export class DeliveryModule {}

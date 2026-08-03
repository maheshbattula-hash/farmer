import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { User } from '../auth/schemas/user.schema';
import { ok, fail } from '../common/http-response';
import { serializeReview } from '../common/serializers';
import { asIdString, isValidObjectId } from '../common/utils/ids';
import { Order } from '../orders/schemas/order.schema';

import { Review } from './schemas/review.schema';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private readonly reviewModel: Model<Review>,
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
  ) {}

  async submitReview(customer: any, body: Record<string, unknown>) {
    const orderId = String(body.order_id || '');
    const requestedFarmerId = String(body.farmer_id || '');
    const rating = Number(body.rating || 0);
    const comment = String(body.comment || '');

    if (!isValidObjectId(orderId)) {
      fail('Order not found or unauthorized.', 'order_not_found', HttpStatus.NOT_FOUND);
    }

    const order: any = await this.orderModel
      .findOne({ _id: orderId, customer: customer._id })
      .populate({ path: 'crop', populate: { path: 'farmer' } });

    if (!order) {
      fail('Order not found or unauthorized.', 'order_not_found', HttpStatus.NOT_FOUND);
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      fail('Rating must be between 1 and 5.', 'invalid_rating');
    }

    const cropFarmerId = asIdString((order.crop as any)?.farmer);
    const farmerId = isValidObjectId(requestedFarmerId) ? requestedFarmerId : cropFarmerId;

    const review = await this.reviewModel.create({
      order: orderId,
      customer: customer._id,
      farmer: farmerId,
      rating,
      comment,
    });

    const populatedReview = await this.reviewModel.findById(review._id).populate('customer');
    return ok('Review submitted! Thank you for your feedback.', {
      review: serializeReview(populatedReview || review),
    });
  }
}

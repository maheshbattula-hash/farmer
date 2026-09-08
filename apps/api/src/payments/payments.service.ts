import { createHmac } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import Razorpay from 'razorpay';

import { User } from '../auth/schemas/user.schema';
import { fail, ok } from '../common/http-response';
import { serializeCustomerOrder, serializeNotification } from '../common/serializers';
import { env } from '../common/utils/env';
import { asIdString, isValidObjectId } from '../common/utils/ids';
import { Crop } from '../marketplace/schemas/crop.schema';
import { Order } from '../orders/schemas/order.schema';
import { OrderUpdate } from '../orders/schemas/order-update.schema';
import { Notification } from '../smart/schemas/notification.schema';

@Injectable()
export class PaymentsService {
  private razorpayClient: Razorpay | null = null;

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(OrderUpdate.name) private readonly orderUpdateModel: Model<OrderUpdate>,
    @InjectModel(Crop.name) private readonly cropModel: Model<Crop>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Notification.name) private readonly notificationModel: Model<Notification>,
  ) {}

  private getRazorpayInstance(): Razorpay {
    if (!env.razorpayKeyId || !env.razorpayKeySecret) {
      fail(
        'Razorpay API credentials are not configured on the backend server.',
        'razorpay_not_configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (!this.razorpayClient) {
      this.razorpayClient = new Razorpay({
        key_id: env.razorpayKeyId,
        key_secret: env.razorpayKeySecret,
      });
    }
    return this.razorpayClient;
  }

  async createRazorpayOrder(customer: any, body: Record<string, unknown>) {
    const orderId = String(body.orderId || body.order_id || '');
    if (!isValidObjectId(orderId)) {
      fail('Order not found', 'order_not_found', HttpStatus.NOT_FOUND);
    }

    const order: any = await this.orderModel.findOne({ _id: orderId, customer: customer._id }).populate({
      path: 'crop',
      populate: { path: 'farmer' },
    });

    if (!order) {
      fail('Order not found or unauthorized', 'order_not_found', HttpStatus.NOT_FOUND);
    }

    if (order.payment_status === 'confirmed') {
      fail('This order has already been paid.', 'order_already_paid', HttpStatus.BAD_REQUEST);
    }

    const totalPrice = Number(order.total_price || 0);
    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
      fail('Invalid order total amount.', 'invalid_order_amount', HttpStatus.BAD_REQUEST);
    }

    // Convert amount to paise (1 INR = 100 paise)
    const amountInPaise = Math.round(totalPrice * 100);

    const razorpay = this.getRazorpayInstance();

    try {
      const razorpayOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `rcpt_${asIdString(order._id)}`.slice(0, 40),
        notes: {
          internal_order_id: asIdString(order._id),
          customer_id: asIdString(customer._id),
          customer_email: customer.email || '',
        },
      });

      const existingGatewayDetails = order.payment_gateway_details || {};
      order.payment_gateway_details = {
        ...existingGatewayDetails,
        razorpay_order_id: razorpayOrder.id,
        created_at_razorpay: razorpayOrder.created_at,
      };
      await order.save();

      return ok('Razorpay order created successfully', {
        razorpayOrderId: razorpayOrder.id,
        amount: totalPrice,
        amountPaise: amountInPaise,
        currency: 'INR',
        keyId: env.razorpayKeyId,
        orderId: asIdString(order._id),
        customer: {
          name: customer.full_name || customer.username || '',
          email: customer.email || '',
          phone: customer.phone || customer.adminPhone || '',
        },
      });
    } catch (err: any) {
      const statusCode = err?.statusCode || err?.status || 400;
      const description = err?.error?.description || err?.message || 'Unknown gateway error';
      console.error('[Razorpay API Error]', {
        statusCode,
        code: err?.error?.code || 'GATEWAY_ERROR',
        description,
      });
      const isAuthError = description.toLowerCase().includes('authentication failed');
      const userMessage = isAuthError
        ? 'Unable to create Razorpay order. Please check the backend payment configuration and try again.'
        : `Failed to create Razorpay order: ${description}`;

      fail(
        userMessage,
        'razorpay_order_creation_failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async verifyRazorpayPayment(customer: any, body: Record<string, unknown>) {
    const internalOrderId = String(body.internalOrderId || body.orderId || body.order_id || '');
    const razorpayOrderId = String(body.razorpay_order_id || body.razorpayOrderId || '');
    const razorpayPaymentId = String(body.razorpay_payment_id || body.razorpayPaymentId || '');
    const razorpaySignature = String(body.razorpay_signature || body.razorpaySignature || '');

    if (!internalOrderId || !isValidObjectId(internalOrderId)) {
      fail('Invalid internal order ID.', 'invalid_order_id', HttpStatus.BAD_REQUEST);
    }
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      fail('Missing Razorpay payment verification parameters.', 'missing_payment_params', HttpStatus.BAD_REQUEST);
    }

    const order: any = await this.orderModel.findOne({ _id: internalOrderId, customer: customer._id }).populate({
      path: 'crop',
      populate: { path: 'farmer' },
    });

    if (!order) {
      fail('Order not found or unauthorized.', 'order_not_found', HttpStatus.NOT_FOUND);
    }

    // Idempotency check: if order is already confirmed with the same payment reference
    if (order.payment_status === 'confirmed' && order.payment_reference === razorpayPaymentId) {
      return ok('Payment already verified.', {
        verified: true,
        order: serializeCustomerOrder(order, await this.findUpdatesForOrder(order._id)),
      });
    }

    // Verify signature using HMAC SHA256
    const secret = env.razorpayKeySecret;
    if (!secret) {
      fail('Razorpay Key Secret is missing on the server.', 'missing_key_secret', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const generatedSignature = createHmac('sha256', secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (generatedSignature !== razorpaySignature) {
      fail('Payment signature verification failed. Invalid signature.', 'invalid_signature', HttpStatus.BAD_REQUEST);
    }

    // Verify Razorpay order ID matches stored order ID if previously created
    const storedRzpOrderId = order.payment_gateway_details?.razorpay_order_id;
    if (storedRzpOrderId && storedRzpOrderId !== razorpayOrderId) {
      fail('Razorpay order ID mismatch.', 'order_id_mismatch', HttpStatus.BAD_REQUEST);
    }

    // Mark order as PAID
    order.payment_status = 'confirmed';
    order.payment_method = 'Online (Razorpay)';
    order.payment_provider = 'Razorpay';
    order.payment_reference = razorpayPaymentId;
    order.payment_gateway_details = {
      ...(order.payment_gateway_details || {}),
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
      verified_at: new Date().toISOString(),
    };
    if (order.status === 'Order Placed') {
      order.status = 'Order Confirmed';
    }

    await order.save();

    await this.recordOrderUpdate(order._id, 'Order Confirmed', order.current_location || 'Razorpay Payment Verified');

    const farmerId = order.crop?.farmer?._id || order.crop?.farmer;
    await Promise.all([
      this.createNotification(
        order.customer,
        'Payment successful',
        `Payment of ₹${order.total_price} confirmed for ${order.crop?.name || 'your order'}.`,
        'payment',
        {
          order_id: asIdString(order._id),
          razorpay_payment_id: razorpayPaymentId,
        },
      ),
      this.createNotification(
        farmerId,
        'Buyer payment received',
        `Online payment received via Razorpay for ${order.crop?.name || 'a crop order'}.`,
        'payment',
        {
          order_id: asIdString(order._id),
          razorpay_payment_id: razorpayPaymentId,
        },
      ),
    ]);

    return ok('Payment successful and verified!', {
      verified: true,
      order: serializeCustomerOrder(order, await this.findUpdatesForOrder(order._id)),
      gateway: {
        provider: 'Razorpay',
        method: 'Online',
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        amount: Number(order.total_price || 0),
        status: 'captured',
      },
      notification: serializeNotification({
        title: 'Payment successful',
        body: `Payment ID: ${razorpayPaymentId}`,
      }),
    });
  }

  async getPaymentStatus(customer: any, orderId: string) {
    if (!isValidObjectId(orderId)) {
      fail('Order not found', 'order_not_found', HttpStatus.NOT_FOUND);
    }
    const order: any = await this.orderModel.findOne({ _id: orderId, customer: customer._id });
    if (!order) {
      fail('Order not found', 'order_not_found', HttpStatus.NOT_FOUND);
    }

    return ok('Payment status loaded', {
      order_id: asIdString(order._id),
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      payment_provider: order.payment_provider,
      payment_reference: order.payment_reference,
      razorpay_order_id: order.payment_gateway_details?.razorpay_order_id || '',
      razorpay_payment_id: order.payment_gateway_details?.razorpay_payment_id || '',
      total_price: order.total_price,
    });
  }

  private async recordOrderUpdate(orderId: any, status: string, location: string): Promise<void> {
    await this.orderUpdateModel.create({
      order: orderId,
      status,
      location: location || 'System',
    });
  }

  private async findUpdatesForOrder(orderId: any): Promise<any[]> {
    return this.orderUpdateModel.find({ order: orderId }).sort({ timestamp: 1 }).lean();
  }

  private async createNotification(
    recipientId: any,
    title: string,
    body: string,
    type: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    if (!recipientId) {
      return;
    }
    await this.notificationModel.create({
      user: recipientId,
      title,
      body,
      type,
      metadata,
    });
  }
}

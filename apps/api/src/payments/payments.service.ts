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
      console.log(`[PAYMENT DEBUG] Creating Razorpay order: internalOrderId=${asIdString(order._id)}, amount=${totalPrice} INR (${amountInPaise} paise)`);
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

      console.log(`[PAYMENT DEBUG] Gateway order created: gatewayOrderId=${razorpayOrder.id}, internalOrderId=${asIdString(order._id)}`);

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
      console.error('[PAYMENT DEBUG] Razorpay API order creation failed:', {
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
    let razorpayPaymentId = String(body.razorpay_payment_id || body.razorpayPaymentId || '');
    const razorpaySignature = String(body.razorpay_signature || body.razorpaySignature || '');

    console.log(`[PAYMENT DEBUG] Backend verification request received: internalOrderId=${internalOrderId}, rzpOrderId=${razorpayOrderId}, rzpPaymentId=${razorpayPaymentId}, hasSignature=${Boolean(razorpaySignature)}`);

    if (!internalOrderId || !isValidObjectId(internalOrderId)) {
      fail('Invalid internal order ID.', 'invalid_order_id', HttpStatus.BAD_REQUEST);
    }

    const order: any = await this.orderModel.findOne({ _id: internalOrderId, customer: customer._id }).populate({
      path: 'crop',
      populate: { path: 'farmer' },
    });

    if (!order) {
      fail('Order not found or unauthorized.', 'order_not_found', HttpStatus.NOT_FOUND);
    }

    // Idempotency check: if order is already confirmed
    if (order.payment_status === 'confirmed') {
      console.log(`[PAYMENT DEBUG] Order ${internalOrderId} is already confirmed (idempotent response).`);
      return ok('Payment already verified.', {
        verified: true,
        order: serializeCustomerOrder(order, await this.findUpdatesForOrder(order._id)),
        gateway: {
          provider: 'Razorpay',
          method: order.payment_method || 'Online (Razorpay)',
          razorpay_order_id: order.payment_gateway_details?.razorpay_order_id || razorpayOrderId,
          razorpay_payment_id: order.payment_reference || razorpayPaymentId,
          amount: Number(order.total_price || 0),
          status: 'captured',
        },
      });
    }

    const targetRzpOrderId = razorpayOrderId || String(order.payment_gateway_details?.razorpay_order_id || '');
    const razorpay = this.getRazorpayInstance();
    const secret = env.razorpayKeySecret;

    let isVerified = false;
    let failureReason = '';

    // PATH 1: Verification using HMAC SHA256 Signature (standard callback)
    if (targetRzpOrderId && razorpayPaymentId && razorpaySignature && secret) {
      const generatedSignature = createHmac('sha256', secret)
        .update(`${targetRzpOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (generatedSignature === razorpaySignature) {
        console.log(`[PAYMENT DEBUG] Cryptographic HMAC SHA256 signature verified successfully for order ${internalOrderId}.`);
        isVerified = true;
      } else {
        console.warn(`[PAYMENT DEBUG] Signature mismatch for order ${internalOrderId}. Falling back to direct Razorpay API check.`);
      }
    }

    let successfulPaymentRecord: any = null;

    // PATH 2: Direct Gateway Verification via Razorpay API (handles Netbanking, UPI app redirects, missing callbacks)
    if (!isVerified && targetRzpOrderId) {
      try {
        console.log(`[PAYMENT DEBUG] Querying Razorpay Gateway directly for order ${targetRzpOrderId}...`);
        const paymentsList: any = await razorpay.orders.fetchPayments(targetRzpOrderId);
        const payments = paymentsList?.items || [];
        console.log(`[PAYMENT DEBUG] Razorpay Gateway returned ${payments.length} payment record(s) for order ${targetRzpOrderId}.`);

        // Look for any successful (captured or authorized) payment
        const successfulPayment = payments.find(
          (p: any) => p.status === 'captured' || p.status === 'authorized'
        );

        if (successfulPayment) {
          successfulPaymentRecord = successfulPayment;
          razorpayPaymentId = successfulPayment.id;
          console.log(`[PAYMENT DEBUG] Found successful payment ${successfulPayment.id} with status '${successfulPayment.status}' on Razorpay.`);

          // If payment is authorized but not yet captured, auto-capture it
          if (successfulPayment.status === 'authorized') {
            try {
              console.log(`[PAYMENT DEBUG] Capturing authorized payment ${successfulPayment.id}...`);
              await razorpay.payments.capture(successfulPayment.id, successfulPayment.amount, successfulPayment.currency || 'INR');
              console.log(`[PAYMENT DEBUG] Payment ${successfulPayment.id} successfully captured.`);
            } catch (captureErr: any) {
              console.warn('[PAYMENT DEBUG] Auto-capture note:', captureErr?.message);
            }
          }

          isVerified = true;
        } else {
          // Check if any payment failed
          const failedPayment = payments.find((p: any) => p.status === 'failed');
          if (failedPayment) {
            failureReason = failedPayment.error_description || failedPayment.error_reason || 'Payment was declined by your bank or payment provider.';
            console.log(`[PAYMENT DEBUG] Gateway reported failed payment: ${failureReason}`);
          }
        }
      } catch (gatewayErr: any) {
        console.error('[PAYMENT DEBUG] Error querying Razorpay API:', gatewayErr?.message);
      }
    }

    // Determine specific payment instrument (UPI, Cards, Netbanking, Wallet)
    let paymentMethodLabel = 'Online (Razorpay)';
    let paymentVpa = '';

    if (isVerified && razorpayPaymentId) {
      if (!successfulPaymentRecord) {
        try {
          successfulPaymentRecord = await razorpay.payments.fetch(razorpayPaymentId);
        } catch (_) {}
      }

      if (successfulPaymentRecord) {
        const pMethod = String(successfulPaymentRecord.method || '').toLowerCase();
        paymentVpa = String(successfulPaymentRecord.vpa || '');
        if (pMethod === 'upi') {
          paymentMethodLabel = 'Online (UPI - Razorpay)';
        } else if (pMethod === 'card') {
          paymentMethodLabel = 'Online (Card - Razorpay)';
        } else if (pMethod === 'netbanking') {
          paymentMethodLabel = 'Online (Netbanking - Razorpay)';
        } else if (pMethod === 'wallet') {
          paymentMethodLabel = 'Online (Wallet - Razorpay)';
        }
      }

      order.payment_status = 'confirmed';
      order.payment_method = paymentMethodLabel;
      order.payment_provider = 'Razorpay';
      order.payment_reference = razorpayPaymentId;
      order.payment_gateway_details = {
        ...(order.payment_gateway_details || {}),
        razorpay_order_id: targetRzpOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature || 'verified_via_gateway_api',
        method: paymentMethodLabel,
        vpa: paymentVpa || undefined,
        verified_at: new Date().toISOString(),
      };
      if (order.status === 'Order Placed' || order.status === 'PENDING') {
        order.status = 'Order Confirmed';
      }

      await order.save();
      console.log(`[PAYMENT DEBUG] Database payment status updated: orderId=${internalOrderId}, status=${order.status}, payment_status=confirmed, method=${paymentMethodLabel}, reference=${razorpayPaymentId}`);

      await this.recordOrderUpdate(order._id, 'Order Confirmed', order.current_location || 'Razorpay Online Payment Verified');

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
          method: paymentMethodLabel,
          razorpay_order_id: targetRzpOrderId,
          razorpay_payment_id: razorpayPaymentId,
          vpa: paymentVpa || undefined,
          amount: Number(order.total_price || 0),
          status: 'captured',
        },
        notification: serializeNotification({
          title: 'Payment successful',
          body: `Payment ID: ${razorpayPaymentId}`,
        }),
      });
    }

    // If verification did not succeed
    console.log(`[PAYMENT DEBUG] Verification incomplete for order ${internalOrderId}: ${failureReason || 'Payment pending or not completed'}`);
    return ok('Payment verification result', {
      verified: false,
      payment_status: failureReason ? 'failed' : 'pending',
      message: failureReason || 'Payment has not been confirmed by your bank/gateway yet. If you completed payment, please check your Orders tab in a few moments.',
      order: serializeCustomerOrder(order, await this.findUpdatesForOrder(order._id)),
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

    // Auto-sync pending online orders with Razorpay Gateway
    if (order.payment_status === 'pending' && order.payment_gateway_details?.razorpay_order_id) {
      const rzpOrderId = String(order.payment_gateway_details.razorpay_order_id);
      try {
        const razorpay = this.getRazorpayInstance();
        const paymentsList: any = await razorpay.orders.fetchPayments(rzpOrderId);
        const successful = paymentsList?.items?.find((p: any) => p.status === 'captured' || p.status === 'authorized');
        if (successful) {
          let pMethodLabel = 'Online (Razorpay)';
          if (successful.method === 'upi') pMethodLabel = 'Online (UPI - Razorpay)';
          else if (successful.method === 'card') pMethodLabel = 'Online (Card - Razorpay)';
          else if (successful.method === 'netbanking') pMethodLabel = 'Online (Netbanking - Razorpay)';
          else if (successful.method === 'wallet') pMethodLabel = 'Online (Wallet - Razorpay)';

          order.payment_status = 'confirmed';
          order.payment_reference = successful.id;
          order.payment_method = pMethodLabel;
          order.payment_provider = 'Razorpay';
          order.payment_gateway_details = {
            ...order.payment_gateway_details,
            razorpay_payment_id: successful.id,
            method: pMethodLabel,
            vpa: successful.vpa || undefined,
            verified_at: new Date().toISOString(),
          };
          if (order.status === 'Order Placed' || order.status === 'PENDING') {
            order.status = 'Order Confirmed';
          }
          await order.save();
          console.log(`[PAYMENT DEBUG] Order ${orderId} auto-synced to confirmed via getPaymentStatus.`);
        }
      } catch (err: any) {
        console.warn(`[PAYMENT DEBUG] Could not auto-sync status for order ${orderId}:`, err?.message);
      }
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

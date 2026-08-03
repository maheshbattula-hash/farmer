import { randomBytes } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { User } from '../auth/schemas/user.schema';
import { DEV_PAYMENT_METHODS, DEV_PAYMENT_PROVIDERS, type DevPaymentMethod } from '../common/constants';
import { ok, fail } from '../common/http-response';
import {
  serializeAdminOrder,
  serializeCustomerOrder,
  serializeFarmerDashboardOrder,
  serializeNotification,
  serializeUser,
} from '../common/serializers';
import { asIdString, isValidObjectId } from '../common/utils/ids';
import { sendEmailMessage } from '../common/utils/mailer';
import { Crop } from '../marketplace/schemas/crop.schema';
import { Notification } from '../smart/schemas/notification.schema';

import { Order } from './schemas/order.schema';
import { OrderUpdate } from './schemas/order-update.schema';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(OrderUpdate.name) private readonly orderUpdateModel: Model<OrderUpdate>,
    @InjectModel(Crop.name) private readonly cropModel: Model<Crop>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Notification.name) private readonly notificationModel: Model<Notification>,
  ) {}

  async placeOrder(customer: any, body: Record<string, unknown>) {
    const cropId = String(body.crop_id || '');
    const quantity = Number(body.quantity || 0);
    const buyerNote = String(body.buyer_note || '').trim();
    const deliveryAddress = String(body.delivery_address || '').trim();
    const fulfillmentWindow = String(body.fulfillment_window || '').trim();
    const requestedBulk = this.toBoolean(body.is_bulk_order);
    const paymentMethod = String(body.payment_method || 'UPI').trim();

    if (!isValidObjectId(cropId)) {
      fail('Crop not found', 'crop_not_found', HttpStatus.NOT_FOUND);
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      fail('Requested quantity must be greater than zero', 'invalid_quantity');
    }

    const existingCrop: any = await this.cropModel.findById(cropId).populate('farmer');
    if (!existingCrop) {
      fail('Crop not found', 'crop_not_found', HttpStatus.NOT_FOUND);
    }

    const minOrderQuantity = Math.max(Number(existingCrop.min_order_quantity || 1), 0.1);
    if (quantity < minOrderQuantity) {
      fail(`Minimum order quantity is ${minOrderQuantity} ${existingCrop.unit || 'kg'}.`, 'below_minimum_order');
    }

    const crop: any = await this.cropModel
      .findOneAndUpdate(
        { _id: cropId, quantity: { $gte: quantity } },
        { $inc: { quantity: -quantity } },
        { new: true },
      )
      .populate('farmer');

    if (!crop) {
      fail('Requested quantity not available', 'insufficient_stock');
    }

    crop.stock_status = this.computeStockStatus(Number(crop.quantity || 0), Number(crop.min_order_quantity || 1));
    await crop.save();

    const farmer = crop.farmer as any;
    const totalPrice = Number((quantity * Number(crop.price || 0)).toFixed(2));
    const order = await this.orderModel.create({
      customer: customer._id,
      crop: crop._id,
      quantity,
      total_price: totalPrice,
      status: 'Order Placed',
      payment_status: 'pending',
      payment_method: paymentMethod,
      estimated_delivery: this.estimateDelivery(customer, farmer, crop),
      current_location: farmer.city || farmer.state || '',
      is_bulk_order: requestedBulk || quantity >= minOrderQuantity * 10 || totalPrice >= 5000,
      buyer_note: buyerNote,
      delivery_address: deliveryAddress || [customer.city, customer.district, customer.state, customer.pincode].filter(Boolean).join(', '),
      fulfillment_window: fulfillmentWindow || (crop.same_day_available ? 'Today 5pm-8pm' : 'Next available slot'),
      invoice_number: this.generateInvoiceNumber(),
      tracking_code: this.generateTrackingCode(),
    });

    await this.recordOrderUpdate(order._id, 'Order Placed', farmer.city || farmer.state || '');

    const populatedOrder: any = await this.orderModel
      .findById(order._id)
      .populate('customer')
      .populate({ path: 'crop', populate: { path: 'farmer' } });

    if (!populatedOrder) {
      fail('Order could not be loaded', 'order_not_found', HttpStatus.NOT_FOUND);
    }

    await Promise.all([
      this.notifyFarmerNewOrder(populatedOrder, customer),
      this.createNotification(farmer._id, 'New order request', `You received a new order for ${crop.name}.`, 'order', {
        order_id: asIdString(order._id),
        crop_id: asIdString(crop._id),
      }),
      this.createNotification(customer._id, 'Order placed', `Your order for ${crop.name} has been created. Complete payment to confirm it.`, 'order', {
        order_id: asIdString(order._id),
        crop_id: asIdString(crop._id),
      }),
    ]);

    return ok('Order placed! Proceed to payment.', {
      order: serializeCustomerOrder(populatedOrder, await this.findUpdatesForOrder(order._id)),
      order_id: asIdString(order._id),
      redirect: `/checkout/${asIdString(order._id)}`,
    });
  }

  async myOrders(customer: any) {
    const orders = await this.orderModel
      .find({ customer: customer._id })
      .sort({ order_date: -1 })
      .populate('customer')
      .populate({ path: 'crop', populate: { path: 'farmer' } });

    const updatesByOrder = await this.loadUpdatesByOrder(orders.map((order: any) => asIdString(order._id)));
    const serialized = orders.map((order: any) => serializeCustomerOrder(order, updatesByOrder.get(asIdString(order._id)) || []));
    const activeOrders = serialized.filter((order: any) => !['Delivered', 'Cancelled'].includes(String(order.status)));
    const orderHistory = serialized.filter((order: any) => ['Delivered', 'Cancelled'].includes(String(order.status)));

    return ok('Orders loaded', {
      active_orders: activeOrders,
      order_history: orderHistory,
      summary: {
        active_count: activeOrders.length,
        completed_count: orderHistory.filter((order: any) => order.status === 'Delivered').length,
        cancelled_count: orderHistory.filter((order: any) => order.status === 'Cancelled').length,
      },
    });
  }

  async orderDetail(customer: any, orderId: string) {
    const order = await this.findCustomerOrder(orderId, customer, true);
    if (!order) {
      fail('Order not found', 'order_not_found', HttpStatus.NOT_FOUND);
    }

    return ok('Order loaded', {
      order: serializeCustomerOrder(order, await this.findUpdatesForOrder(order._id)),
      payment_gateway: this.buildDevGatewayConfig(order),
    });
  }

  async invoiceForUser(user: any, orderId: string) {
    const order = await this.findAccessibleOrder(user, orderId);
    if (!order) {
      fail('Order not found', 'order_not_found', HttpStatus.NOT_FOUND);
    }

    const updates = await this.findUpdatesForOrder(order._id);
    const serialized = serializeCustomerOrder(order, updates);
    const crop = order.crop as any;
    const farmer = crop?.farmer as any;
    const customer = order.customer as any;
    const unitPrice = Number(order.quantity || 0) > 0 ? Number(order.total_price || 0) / Number(order.quantity || 1) : 0;

    return ok('Invoice loaded', {
      order: serialized,
      invoice: {
        invoice_number: order.invoice_number || this.generateInvoiceNumber(),
        order_id: asIdString(order._id),
        customer: serializeUser(customer),
        farmer: serializeUser(farmer),
        crop: {
          id: asIdString(crop?._id),
          name: crop?.name || '',
          unit: crop?.unit || 'kg',
        },
        line_items: [
          {
            label: crop?.name || 'Crop order',
            quantity: Number(order.quantity || 0),
            unit_price: Number(unitPrice.toFixed(2)),
            total: Number(order.total_price || 0),
          },
        ],
        subtotal: Number(order.total_price || 0),
        grand_total: Number(order.total_price || 0),
        payment_status: order.payment_status || 'pending',
        payment_method: order.payment_method || '',
        payment_provider: order.payment_provider || '',
        payment_reference: order.payment_reference || '',
        payment_gateway_details: order.payment_gateway_details || {},
        gateway_mode: 'dev_dummy',
        estimated_delivery: order.estimated_delivery || '',
        fulfillment_window: order.fulfillment_window || '',
        delivery_address: order.delivery_address || '',
        tracking_code: order.tracking_code || '',
      },
    });
  }

  async cancelOrder(customer: any, orderId: string) {
    const order: any = await this.findCustomerOrder(orderId, customer, true);
    if (!order) {
      fail('Order not found or unauthorized.', 'order_not_found', HttpStatus.NOT_FOUND);
    }
    if (!['Order Placed', 'Order Confirmed', 'Packed'].includes(String(order.status))) {
      fail('Cannot cancel an order that has already been shipped or completed.', 'order_not_cancellable');
    }

    order.status = 'Cancelled';
    order.payment_status = order.payment_status === 'confirmed' ? 'refunding' : 'cancelled';
    await order.save();
    await this.recordOrderUpdate(order._id, 'Cancelled', 'System');

    const cropDoc: any = await this.cropModel.findById(order.crop?._id || order.crop);
    if (cropDoc) {
      cropDoc.quantity = Number(cropDoc.quantity || 0) + Number(order.quantity || 0);
      cropDoc.stock_status = this.computeStockStatus(Number(cropDoc.quantity || 0), Number(cropDoc.min_order_quantity || 1));
      await cropDoc.save();
    }

    await Promise.all([
      this.createNotification(order.customer, 'Order cancelled', `Order ${order.invoice_number || asIdString(order._id)} has been cancelled.`, 'order', {
        order_id: asIdString(order._id),
      }),
      this.createNotification(order.crop?.farmer?._id || order.crop?.farmer, 'Order cancelled', `A customer cancelled the order for ${order.crop?.name || 'your crop'}.`, 'order', {
        order_id: asIdString(order._id),
      }),
    ]);

    return ok('Order has been cancelled successfully.');
  }

  async confirmPayment(customer: any, body: Record<string, unknown>) {
    const orderId = String(body.order_id || '');
    const order: any = await this.findCustomerOrder(orderId, customer, true);
    if (!order) {
      fail('Order not found', 'order_not_found', HttpStatus.NOT_FOUND);
    }

    const paymentSession = this.createDevPaymentSession(customer, order, body);
    order.payment_status = 'confirmed';
    order.payment_method = paymentSession.method;
    order.payment_provider = paymentSession.provider;
    order.payment_reference = paymentSession.reference;
    order.payment_gateway_details = paymentSession.gatewayDetails;
    order.status = order.status === 'Order Placed' ? 'Order Confirmed' : order.status;
    if (!order.invoice_number) {
      order.invoice_number = this.generateInvoiceNumber();
    }
    if (!order.tracking_code) {
      order.tracking_code = this.generateTrackingCode();
    }
    await order.save();
    await this.recordOrderUpdate(order._id, 'Order Confirmed', order.current_location || 'Payment confirmed');
    await this.notifyCustomerPaymentConfirmed(order, customer);

    const farmerId = order.crop?.farmer?._id || order.crop?.farmer;
    await Promise.all([
      this.createNotification(order.customer, 'Payment confirmed', `Payment for ${order.crop?.name || 'your order'} is confirmed.`, 'payment', {
        order_id: asIdString(order._id),
        method: paymentSession.method,
        provider: paymentSession.provider,
      }),
      this.createNotification(farmerId, 'Buyer payment received', `Payment is confirmed for ${order.crop?.name || 'a crop order'}.`, 'payment', {
        order_id: asIdString(order._id),
        method: paymentSession.method,
        provider: paymentSession.provider,
      }),
    ]);

    return ok('Payment successful! The dev gateway has approved this sandbox transaction.', {
      order: serializeCustomerOrder(order, await this.findUpdatesForOrder(order._id)),
      gateway: {
        mode: 'dev_dummy',
        method: paymentSession.method,
        provider: paymentSession.provider,
        reference: paymentSession.reference,
        authorized_amount: Number(order.total_price || 0),
        status: 'captured',
        test_only: true,
      },
      notification: serializeNotification({ title: 'Payment confirmed', body: `Payment reference ${paymentSession.reference}` }),
    });
  }

  async farmerUpdateOrder(farmer: any, body: Record<string, unknown>) {
    const orderId = String(body.order_id || '');
    const newStatus = String(body.status || 'Order Confirmed');
    const location = String(body.location || '');
    const trackingCode = String(body.tracking_code || '');

    const order: any = await this.findFarmerOrder(orderId, farmer);
    if (!order) {
      fail('Order not found or unauthorized', 'order_not_found', HttpStatus.NOT_FOUND);
    }

    const previousStatus = String(order.status || '');
    order.status = newStatus;
    order.current_location = location || order.current_location || '';
    if (trackingCode) {
      order.tracking_code = trackingCode;
    }
    await order.save();
    await this.recordOrderUpdate(order._id, newStatus, location || order.current_location || '');

    if (newStatus === 'Order Confirmed' && previousStatus !== 'Order Confirmed') {
      await this.notifyCustomerFarmerApproved(order);
    }
    if (newStatus === 'Delivered') {
      order.current_location = 'Delivered';
      await order.save();
    }

    await this.createNotification(order.customer?._id || order.customer, 'Order status updated', `Your order for ${order.crop?.name || 'a crop'} is now ${newStatus}.`, 'order', {
      order_id: asIdString(order._id),
    });

    return ok(`Order #${asIdString(order._id)} status updated to ${newStatus}`);
  }

  async adminDashboard() {
    const users = await this.userModel.find().sort({ created_at: 1 }).lean();
    const crops = await this.cropModel.find().sort({ created_at: -1 }).populate('farmer');
    const orders = await this.orderModel
      .find()
      .sort({ order_date: -1 })
      .populate('customer')
      .populate({ path: 'crop', populate: { path: 'farmer' } });

    const totalFarmers = users.filter((user: any) => user.role === 'farmer').length;
    const totalCrops = crops.length;
    const totalOrders = orders.length;
    const paidOrders = orders.filter((order: any) => order.payment_status === 'confirmed');
    const totalRevenue = paidOrders.reduce((sum: number, order: any) => sum + Number(order.total_price || 0), 0);

    const categoryCounter = new Map<string, number>();
    crops.forEach((crop: any) => {
      const category = crop.category || 'Uncategorized';
      categoryCounter.set(category, (categoryCounter.get(category) || 0) + 1);
    });

    const revenueByDay = new Map<string, number>();
    paidOrders.forEach((order: any) => {
      if (!order.order_date) {
        return;
      }
      const day = this.toKolkataDate(order.order_date);
      revenueByDay.set(day, (revenueByDay.get(day) || 0) + Number(order.total_price || 0));
    });

    const revenueTrend = [...revenueByDay.entries()]
      .sort((left, right) => right[0].localeCompare(left[0]))
      .slice(0, 7)
      .map(([day, total]) => [day, total]);

    return ok('Admin dashboard loaded', {
      users: users.map((user: any) => serializeUser(user)),
      crops: crops.map((crop: any) => serializeAdminOrder({ crop })),
      orders: orders.map((order: any) => serializeAdminOrder(order)),
      total_farmers: totalFarmers,
      total_crops: totalCrops,
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      category_counts: [...categoryCounter.entries()],
      revenue_trend: revenueTrend,
    });
  }

  async adminUpdateOrder(orderId: string, body: Record<string, unknown>) {
    if (!isValidObjectId(orderId)) {
      fail('Order not found', 'order_not_found', HttpStatus.NOT_FOUND);
    }
    const order = await this.orderModel.findById(orderId);
    if (!order) {
      fail('Order not found', 'order_not_found', HttpStatus.NOT_FOUND);
    }
    const statusValue = String(body.status || order.status);
    order.status = statusValue;
    await order.save();
    await this.recordOrderUpdate(order._id, statusValue, order.current_location || 'Admin dashboard');
    return ok(`Order #${asIdString(order._id)} status updated to ${statusValue}`);
  }

  private async findCustomerOrder(orderId: string, customer: any, includeCustomer = false) {
    if (!isValidObjectId(orderId)) {
      return null;
    }
    let query: any = this.orderModel.findOne({ _id: orderId, customer: customer._id }).populate({
      path: 'crop',
      populate: { path: 'farmer' },
    });
    if (includeCustomer) {
      query = query.populate('customer');
    }
    return query;
  }

  private async findAccessibleOrder(user: any, orderId: string) {
    if (!isValidObjectId(orderId)) {
      return null;
    }
    const order: any = await this.orderModel
      .findById(orderId)
      .populate('customer')
      .populate({ path: 'crop', populate: { path: 'farmer' } });
    if (!order) {
      return null;
    }
    if (user.role === 'admin') {
      return order;
    }
    if (asIdString(order.customer?._id || order.customer) === asIdString(user._id)) {
      return order;
    }
    if (asIdString(order.crop?.farmer?._id || order.crop?.farmer) === asIdString(user._id)) {
      return order;
    }
    return null;
  }

  private async findFarmerOrder(orderId: string, farmer: any) {
    if (!isValidObjectId(orderId)) {
      return null;
    }
    const order: any = await this.orderModel
      .findById(orderId)
      .populate('customer')
      .populate({ path: 'crop', populate: { path: 'farmer' } });

    if (!order) {
      return null;
    }

    const cropFarmerId = asIdString((order.crop as any)?.farmer?._id || (order.crop as any)?.farmer);
    return cropFarmerId === asIdString(farmer._id) ? order : null;
  }

  private async recordOrderUpdate(orderId: unknown, status: string, location = '') {
    return this.orderUpdateModel.create({ order: orderId, status, location: location || '' });
  }

  private async findUpdatesForOrder(orderId: unknown) {
    return this.orderUpdateModel.find({ order: orderId }).sort({ update_date: 1 }).lean();
  }

  private async loadUpdatesByOrder(orderIds: string[]) {
    const result = new Map<string, any[]>();
    if (orderIds.length === 0) {
      return result;
    }

    const updates = await this.orderUpdateModel.find({ order: { $in: orderIds } }).sort({ update_date: 1 }).lean();
    updates.forEach((update: any) => {
      const key = asIdString(update.order);
      const bucket = result.get(key) || [];
      bucket.push(update);
      result.set(key, bucket);
    });
    return result;
  }

  private estimateDelivery(customer: any, farmer: any, crop: any): string {
    let days = 5;
    if (crop?.same_day_available) {
      days = 0;
    } else if (farmer.state && customer.state && farmer.state === customer.state) {
      days = 3;
      if (farmer.city && customer.city && farmer.city === customer.city) {
        days = 1;
      }
    }

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }).format(targetDate);
  }

  private toKolkataDate(value: Date): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(value);
  }

  private generateInvoiceNumber(): string {
    return `INV-${Date.now()}-${randomBytes(2).toString('hex').toUpperCase()}`;
  }

  private generateTrackingCode(): string {
    return `TRK-${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  private computeStockStatus(quantity: number, minOrderQuantity: number): string {
    if (quantity <= 0) {
      return 'Out of Stock';
    }
    if (quantity <= Math.max(minOrderQuantity * 2, 10)) {
      return 'Low Stock';
    }
    return 'Available';
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
  }

  private buildDevGatewayConfig(order: any) {
    const currentMethod = this.normalizePaymentMethod(order?.payment_method || 'UPI');
    return {
      mode: 'dev_dummy',
      methods: DEV_PAYMENT_METHODS.map((method) => ({
        method,
        providers: DEV_PAYMENT_PROVIDERS[method],
      })),
      selected_method: currentMethod,
      selected_provider: String(order?.payment_provider || DEV_PAYMENT_PROVIDERS[currentMethod][0] || ''),
      test_notice: 'Sandbox gateway only. Use demo UPI, test card, or bank selectors to simulate success.',
    };
  }

  private createDevPaymentSession(customer: any, order: any, body: Record<string, unknown>) {
    const method = this.normalizePaymentMethod(body.payment_method || order.payment_method || 'UPI');
    const requestedProvider = String(body.payment_provider || order.payment_provider || '').trim();
    const providers = DEV_PAYMENT_PROVIDERS[method];
    const provider = providers.includes(requestedProvider) ? requestedProvider : providers[0];
    const gatewayDetails: Record<string, unknown> = {
      gateway: 'dev_dummy',
      environment: 'sandbox',
      provider,
      method,
      amount: Number(order.total_price || 0),
      approved_at: new Date().toISOString(),
    };

    let reference = String(body.payment_reference || order.payment_reference || '').trim();
    if (method === 'UPI') {
      const upiId = String(body.upi_id || '').trim() || 'demo@upi';
      if (!/^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/.test(upiId)) {
        fail('Enter a valid UPI ID for the sandbox gateway.', 'invalid_upi');
      }
      gatewayDetails.upi_id = upiId;
      gatewayDetails.collect_request_id = `COLLECT-${randomBytes(2).toString('hex').toUpperCase()}`;
      gatewayDetails.test_hint = 'Any UPI PIN can be used in dev mode.';
      reference ||= `UPI-${Date.now()}-${randomBytes(2).toString('hex').toUpperCase()}`;
    } else if (method === 'Card') {
      const cardName = String(body.card_name || customer.full_name || customer.username || 'Demo Customer').trim();
      const digits = String(body.card_number || '').replace(/\D+/g, '');
      const expiry = String(body.card_expiry || '').trim();
      if (digits.length < 12) {
        fail('Enter a valid test card number for the sandbox gateway.', 'invalid_card');
      }
      if (!expiry) {
        fail('Enter a valid card expiry for the sandbox gateway.', 'invalid_card_expiry');
      }
      gatewayDetails.card_name = cardName;
      gatewayDetails.card_last4 = digits.slice(-4);
      gatewayDetails.card_network = this.guessCardNetwork(digits);
      gatewayDetails.card_expiry = expiry;
      gatewayDetails.auth_code = randomBytes(2).toString('hex').toUpperCase();
      reference ||= `CARD-${Date.now()}-${digits.slice(-4)}`;
    } else {
      const bankName = String(body.bank_name || provider).trim();
      const accountHolder = String(body.account_holder || customer.full_name || customer.username || 'Demo Customer').trim();
      if (!bankName) {
        fail('Select a bank for sandbox net banking.', 'invalid_bank');
      }
      gatewayDetails.bank_name = bankName;
      gatewayDetails.account_holder = accountHolder;
      gatewayDetails.bank_session_id = `NB-${randomBytes(3).toString('hex').toUpperCase()}`;
      gatewayDetails.test_hint = 'This is a simulated net banking authorization.';
      reference ||= `NB-${Date.now()}-${randomBytes(2).toString('hex').toUpperCase()}`;
    }

    return { method, provider, reference, gatewayDetails };
  }

  private normalizePaymentMethod(value: unknown): DevPaymentMethod {
    const method = String(value || '').trim().toLowerCase();
    if (method === 'card') {
      return 'Card';
    }
    if (method === 'net banking' || method === 'netbanking' || method === 'net_banking') {
      return 'Net Banking';
    }
    return 'UPI';
  }

  private guessCardNetwork(cardNumber: string): string {
    if (cardNumber.startsWith('4')) {
      return 'Visa';
    }
    if (/^(5[1-5]|2[2-7])/.test(cardNumber)) {
      return 'Mastercard';
    }
    if (cardNumber.startsWith('6')) {
      return 'RuPay';
    }
    return 'Test Card';
  }

  private async createNotification(userId: unknown, title: string, body: string, category: string, meta: Record<string, unknown> = {}) {
    if (!userId || !isValidObjectId(String(userId))) {
      return null;
    }
    return this.notificationModel.create({
      user: userId,
      title,
      body,
      category,
      meta,
    });
  }

  private async notifyFarmerNewOrder(order: any, customer: any): Promise<void> {
    const farmer = order.crop?.farmer as any;
    if (!farmer?.email) {
      return;
    }
    await sendEmailMessage(
      farmer.email,
      'New Order Request - Smart Farmer Market',
      [
        `Hello ${farmer.full_name},`,
        '',
        `You have received a new order request for ${order.crop?.name}.`,
        `Quantity: ${order.quantity}`,
        `Buyer: ${customer.full_name || customer.username}`,
      ].join('\n'),
    );
  }

  private async notifyCustomerPaymentConfirmed(order: any, customer: any): Promise<void> {
    if (!customer?.email) {
      return;
    }
    await sendEmailMessage(
      customer.email,
      'Payment Confirmed - Smart Farmer Market',
      [
        `Hello ${customer.full_name || customer.username},`,
        '',
        `Payment for ${order.crop?.name} has been confirmed.`,
        `Invoice: ${order.invoice_number || ''}`,
        `Tracking code: ${order.tracking_code || ''}`,
      ].join('\n'),
    );
  }

  private async notifyCustomerFarmerApproved(order: any): Promise<void> {
    const customer = order.customer as any;
    if (!customer?.email) {
      return;
    }
    await sendEmailMessage(
      customer.email,
      'Order Confirmed - Smart Farmer Market',
      [
        `Hello ${customer.full_name || customer.username},`,
        '',
        `Your farmer has confirmed the order for ${order.crop?.name}.`,
        `Tracking code: ${order.tracking_code || ''}`,
      ].join('\n'),
    );
  }
}

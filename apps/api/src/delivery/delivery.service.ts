import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import bcrypt from 'bcryptjs';

import { DeliveryBoy, type DeliveryBoyDocument } from './schemas/delivery-boy.schema';
import { Order, type OrderDocument } from '../orders/schemas/order.schema';
import { generateJwtToken } from './guards/delivery-auth.guard';
import { fail, ok } from '../common/http-response';
import { isValidObjectId, asIdString } from '../common/utils/ids';

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

@Injectable()
export class DeliveryService {
  constructor(
    @InjectModel(DeliveryBoy.name) private readonly deliveryBoyModel: Model<DeliveryBoyDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
  ) {}

  async register(body: Record<string, unknown>) {
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    const password = String(body.password || '');
    const vehicleType = String(body.vehicleType || 'bike').trim();

    if (!name || !phone || !password || !vehicleType) {
      fail('name, phone, password, and vehicleType are required', 'validation_error', HttpStatus.BAD_REQUEST);
    }

    const validVehicles = ['bike', 'scooter', 'bicycle', 'car'];
    if (!validVehicles.includes(vehicleType)) {
      fail(`vehicleType must be one of: ${validVehicles.join(', ')}`, 'invalid_vehicle_type', HttpStatus.BAD_REQUEST);
    }

    const existing = await this.deliveryBoyModel.findOne({ phone });
    if (existing) {
      fail('Phone number is already registered.', 'phone_registered', HttpStatus.BAD_REQUEST);
    }

    const password_hash = await bcrypt.hash(password, 10);

    const deliveryBoy = await this.deliveryBoyModel.create({
      name,
      phone,
      password_hash,
      vehicleType,
      isOnline: true,
      isAvailable: true,
      location: {
        type: 'Point',
        coordinates: [78.4867, 17.3850], // Default coordinates
      },
      lastLocationUpdate: new Date(),
    });

    return {
      success: true,
      message: 'Delivery boy registered successfully.',
      deliveryBoy: {
        id: asIdString(deliveryBoy._id),
        name: deliveryBoy.name,
        phone: deliveryBoy.phone,
        vehicleType: deliveryBoy.vehicleType,
      },
    };
  }

  async login(body: Record<string, unknown>) {
    const phone = String(body.phone || '').trim();
    const password = String(body.password || '');

    if (!phone || !password) {
      fail('phone and password are required', 'validation_error', HttpStatus.BAD_REQUEST);
    }

    const deliveryBoy = await this.deliveryBoyModel.findOne({ phone });
    if (!deliveryBoy || !(await bcrypt.compare(password, deliveryBoy.password_hash))) {
      fail('Invalid credentials', 'invalid_credentials', HttpStatus.UNAUTHORIZED);
    }

    const token = generateJwtToken({
      sub: asIdString(deliveryBoy._id),
      phone: deliveryBoy.phone,
      role: 'delivery_boy',
    });

    return {
      success: true,
      token,
      deliveryBoy: {
        id: asIdString(deliveryBoy._id),
        name: deliveryBoy.name,
      },
    };
  }

  async updateLocation(deliveryBoy: DeliveryBoyDocument, body: Record<string, unknown>) {
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const isOnline = body.isOnline !== undefined ? Boolean(body.isOnline) : true;

    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      fail('latitude must be a number between -90 and 90', 'invalid_latitude', HttpStatus.BAD_REQUEST);
    }
    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      fail('longitude must be a number between -180 and 180', 'invalid_longitude', HttpStatus.BAD_REQUEST);
    }

    const lastLocationUpdate = new Date();

    deliveryBoy.location = {
      type: 'Point',
      coordinates: [longitude, latitude],
    };
    deliveryBoy.isOnline = isOnline;
    deliveryBoy.lastLocationUpdate = lastLocationUpdate;
    await deliveryBoy.save();

    return {
      success: true,
      message: 'Location updated.',
      lastUpdated: lastLocationUpdate.toISOString(),
    };
  }

  async findNearbyDeliveryBoys(query: Record<string, unknown>) {
    const latitude = Number(query.latitude);
    const longitude = Number(query.longitude);
    let radiusKm = Number(query.radius || 10);

    if (isNaN(latitude) || isNaN(longitude)) {
      fail('latitude and longitude query parameters are required', 'validation_error', HttpStatus.BAD_REQUEST);
    }

    // Server enforces max radius of 50 km
    if (isNaN(radiusKm) || radiusKm <= 0) {
      radiusKm = 10;
    }
    if (radiusKm > 50) {
      radiusKm = 50;
    }

    const radiusMeters = radiusKm * 1000;

    let deliveryBoys: DeliveryBoyDocument[] = [];
    try {
      deliveryBoys = await this.deliveryBoyModel.find({
        isOnline: true,
        isAvailable: true,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            $maxDistance: radiusMeters,
          },
        },
      });
    } catch {
      // Fallback in case 2dsphere index building is pending in dev DB
      const allBoys = await this.deliveryBoyModel.find({ isOnline: true, isAvailable: true });
      deliveryBoys = allBoys.filter((b) => {
        const [boyLng, boyLat] = b.location?.coordinates || [0, 0];
        const dist = calculateDistanceKm(latitude, longitude, boyLat, boyLng);
        return dist <= radiusKm;
      });
    }

    const result = deliveryBoys.map((boy) => {
      const [boyLng, boyLat] = boy.location?.coordinates || [0, 0];
      const distanceKm = calculateDistanceKm(latitude, longitude, boyLat, boyLng);
      return {
        id: asIdString(boy._id),
        name: boy.name,
        distanceKm,
        isOnline: boy.isOnline,
        isAvailable: boy.isAvailable,
      };
    });

    return {
      success: true,
      radiusKm,
      deliveryBoys: result,
    };
  }

  async createOrder(body: Record<string, unknown>) {
    const userId = String(body.userId || '').trim();
    const restaurantId = String(body.restaurantId || '').trim();
    const items = Array.isArray(body.items) ? body.items : [];
    const deliveryAddress = String(body.deliveryAddress || '').trim();
    const deliveryLocation = body.deliveryLocation as { latitude?: number; longitude?: number } | undefined;

    if (!userId || !restaurantId || items.length === 0 || !deliveryAddress || !deliveryLocation) {
      fail('userId, restaurantId, items, deliveryAddress, and deliveryLocation are required', 'validation_error', HttpStatus.BAD_REQUEST);
    }

    const lat = Number(deliveryLocation.latitude);
    const lng = Number(deliveryLocation.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      fail('deliveryLocation requires valid latitude and longitude numbers', 'invalid_coordinates', HttpStatus.BAD_REQUEST);
    }

    const order = await this.orderModel.create({
      userId,
      restaurantId,
      items,
      deliveryAddress,
      deliveryLocation: { latitude: lat, longitude: lng },
      deliveryLocationGeo: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      status: 'PENDING',
      deliveryBoyId: null,
      assignedAt: null,
      rejectedDeliveryBoys: [],
    });

    // Find nearby delivery boys within 10 km
    const nearby = await this.findNearbyDeliveryBoys({ latitude: lat, longitude: lng, radius: 10 });
    const notifiedCount = nearby.deliveryBoys.length;

    // Log FCM push notification without customer private info
    console.log(`[FCM Push Notification] Notifying ${notifiedCount} nearby delivery boys for Order ${order._id}. Details: Restaurant=${restaurantId}, Location=[${lat}, ${lng}]`);

    return {
      success: true,
      message: 'Order created. Notifying nearby delivery boys.',
      orderId: asIdString(order._id),
      notifiedDeliveryBoys: notifiedCount,
    };
  }

  async getNearbyOrdersForDeliveryBoy(deliveryBoy: DeliveryBoyDocument) {
    const [boyLng, boyLat] = deliveryBoy.location?.coordinates || [78.4867, 17.3850];

    const pendingOrders = await this.orderModel.find({
      status: 'PENDING',
      deliveryBoyId: null,
      rejectedDeliveryBoys: { $ne: deliveryBoy._id },
    });

    const ordersWithDistance = pendingOrders.map((order) => {
      const orderLat = order.deliveryLocation?.latitude ?? order.deliveryLocationGeo?.coordinates[1] ?? boyLat;
      const orderLng = order.deliveryLocation?.longitude ?? order.deliveryLocationGeo?.coordinates[0] ?? boyLng;
      const distanceKm = calculateDistanceKm(boyLat, boyLng, orderLat, orderLng);

      return {
        orderId: asIdString(order._id),
        restaurantId: order.restaurantId,
        deliveryAddress: (order as any).deliveryAddress || order.delivery_address || '',
        distanceKm,
        status: order.status,
      };
    });

    return {
      success: true,
      orders: ordersWithDistance,
    };
  }

  async acceptOrder(deliveryBoy: DeliveryBoyDocument, orderId: string) {
    if (!deliveryBoy.isOnline || !deliveryBoy.isAvailable) {
      fail('Delivery boy is not available or offline', 'not_available', HttpStatus.BAD_REQUEST);
    }

    if (!isValidObjectId(orderId)) {
      fail('Invalid orderId format', 'invalid_order_id', HttpStatus.BAD_REQUEST);
    }

    // Atomic update findOneAndUpdate to prevent race conditions
    const assignedAt = new Date();
    const updatedOrder = await this.orderModel.findOneAndUpdate(
      {
        _id: orderId,
        status: 'PENDING',
        deliveryBoyId: null,
      },
      {
        $set: {
          status: 'ASSIGNED',
          deliveryBoyId: deliveryBoy._id,
          assignedAt,
        },
      },
      { new: true }
    );

    if (!updatedOrder) {
      const existingOrder = await this.orderModel.findById(orderId);
      if (!existingOrder) {
        fail('Order not found', 'order_not_found', HttpStatus.BAD_REQUEST);
      }
      if (existingOrder.deliveryBoyId && existingOrder.deliveryBoyId.toString() !== deliveryBoy._id.toString()) {
        fail('This order has already been assigned to another delivery boy.', 'already_assigned', HttpStatus.CONFLICT);
      }
      fail('Order is not available for acceptance.', 'order_unavailable', HttpStatus.BAD_REQUEST);
    }

    // Mark delivery boy as unavailable
    deliveryBoy.isAvailable = false;
    await deliveryBoy.save();

    console.log(`[Notification] Customer notified: Delivery boy ${deliveryBoy.name} accepted order ${orderId}`);

    return {
      success: true,
      message: 'Order accepted. You have been assigned to this delivery.',
      orderId: asIdString(updatedOrder._id),
      assignedAt: assignedAt.toISOString(),
    };
  }

  async rejectOrder(deliveryBoy: DeliveryBoyDocument, orderId: string) {
    if (!isValidObjectId(orderId)) {
      fail('Invalid orderId format', 'invalid_order_id', HttpStatus.BAD_REQUEST);
    }

    const order = await this.orderModel.findById(orderId);
    if (!order) {
      fail('Order not found', 'order_not_found', HttpStatus.NOT_FOUND);
    }

    await this.orderModel.updateOne(
      { _id: orderId },
      { $addToSet: { rejectedDeliveryBoys: deliveryBoy._id } }
    );

    return {
      success: true,
      message: 'Order rejected. You will not be notified for this order again.',
    };
  }

  async getOrderTracking(orderId: string) {
    if (!isValidObjectId(orderId)) {
      fail('Order not found or not yet assigned', 'order_not_found', HttpStatus.NOT_FOUND);
    }

    const order = await this.orderModel.findById(orderId);
    if (!order || !order.deliveryBoyId) {
      fail('Order not found or not yet assigned', 'order_not_found', HttpStatus.NOT_FOUND);
    }

    const deliveryBoy = await this.deliveryBoyModel.findById(order.deliveryBoyId);
    if (!deliveryBoy) {
      fail('Assigned delivery boy not found', 'delivery_boy_not_found', HttpStatus.NOT_FOUND);
    }

    const [lng, lat] = deliveryBoy.location?.coordinates || [78.4867, 17.3850];

    return {
      orderId: asIdString(order._id),
      status: order.status,
      deliveryBoy: {
        id: asIdString(deliveryBoy._id),
        name: deliveryBoy.name,
      },
      location: {
        latitude: lat,
        longitude: lng,
      },
      lastUpdated: deliveryBoy.lastLocationUpdate ? deliveryBoy.lastLocationUpdate.toISOString() : new Date().toISOString(),
    };
  }
}

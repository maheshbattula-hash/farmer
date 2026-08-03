import fs from 'node:fs/promises';

import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { User } from '../auth/schemas/user.schema';
import { MARKETPLACE_CATEGORIES, MARKETPLACE_STATES } from '../common/constants';
import { ok, fail } from '../common/http-response';
import {
  serializeCrop,
  serializeFarmerDashboardOrder,
  serializeReview,
  serializeUser,
} from '../common/serializers';
import { env } from '../common/utils/env';
import { asIdString, isValidObjectId } from '../common/utils/ids';
import { Order } from '../orders/schemas/order.schema';
import { OrderUpdate } from '../orders/schemas/order-update.schema';
import { Review } from '../reviews/schemas/review.schema';

import { Crop } from './schemas/crop.schema';

interface UploadedFile {
  filename: string;
  path: string;
  size: number;
}

@Injectable()
export class MarketplaceService {
  constructor(
    @InjectModel(Crop.name) private readonly cropModel: Model<Crop>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Review.name) private readonly reviewModel: Model<Review>,
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(OrderUpdate.name) private readonly orderUpdateModel: Model<OrderUpdate>,
  ) {}

  async listCrops(queryParams: Record<string, unknown>) {
    const query = String(queryParams.query || '').trim();
    const state = String(queryParams.state || '').trim();
    const district = String(queryParams.district || '').trim();
    const category = String(queryParams.category || '').trim();
    const sort = String(queryParams.sort || 'newest').trim();
    const verifiedOnly = this.toBoolean(queryParams.verified_only);
    const priceMin = this.toNumber(queryParams.price_min, NaN);
    const priceMax = this.toNumber(queryParams.price_max, NaN);

    const filter: Record<string, unknown> = {};
    if (query) {
      const regex = new RegExp(this.escapeRegex(query), 'i');
      filter.$or = [
        { name: regex },
        { description: regex },
        { village: regex },
        { district: regex },
        { state: regex },
        { tags: regex },
      ];
    }
    if (state) {
      filter.state = state;
    }
    if (district) {
      filter.district = district;
    }
    if (category) {
      filter.category = category;
    }
    if (Number.isFinite(priceMin) || Number.isFinite(priceMax)) {
      filter.price = {};
      if (Number.isFinite(priceMin)) {
        (filter.price as Record<string, number>).$gte = priceMin;
      }
      if (Number.isFinite(priceMax)) {
        (filter.price as Record<string, number>).$lte = priceMax;
      }
    }

    const sortBy: Record<string, 1 | -1> =
      sort === 'price_low'
        ? { price: 1, created_at: -1 }
        : sort === 'price_high'
          ? { price: -1, created_at: -1 }
          : sort === 'demand'
            ? { demand_score: -1, created_at: -1 }
            : sort === 'stock'
              ? { quantity: -1, created_at: -1 }
              : { created_at: -1 };

    let crops: any[] = await this.cropModel.find(filter).sort(sortBy).populate('farmer');
    if (verifiedOnly) {
      crops = crops.filter((crop: any) => Boolean(crop.farmer?.is_verified));
    }

    const farmerIds = [...new Set(crops.map((crop: any) => asIdString(crop.farmer?._id || crop.farmer)).filter(Boolean))];
    const reviews = farmerIds.length ? await this.reviewModel.find({ farmer: { $in: farmerIds } }).lean() : [];
    const ratingMap = new Map<string, { total: number; count: number }>();
    reviews.forEach((review: any) => {
      const key = asIdString(review.farmer);
      const bucket = ratingMap.get(key) || { total: 0, count: 0 };
      bucket.total += Number(review.rating || 0);
      bucket.count += 1;
      ratingMap.set(key, bucket);
    });

    const serialized = crops.map((crop: any) => {
      const item = serializeCrop(crop) as Record<string, unknown>;
      const farmerId = String(item.farmer_id || '');
      const rating = ratingMap.get(farmerId);
      return {
        ...item,
        farmer_rating: rating && rating.count ? Number((rating.total / rating.count).toFixed(1)) : 0,
      };
    });

    return ok('Marketplace loaded', {
      crops: serialized,
      categories: MARKETPLACE_CATEGORIES,
      states: MARKETPLACE_STATES,
      sort_options: [
        { value: 'newest', label: 'Newest' },
        { value: 'demand', label: 'Highest demand' },
        { value: 'stock', label: 'Most stock' },
        { value: 'price_low', label: 'Price: low to high' },
        { value: 'price_high', label: 'Price: high to low' },
      ],
      stats: {
        total_results: serialized.length,
        verified_results: serialized.filter((crop: any) => Boolean(crop.is_verified)).length,
        organic_results: serialized.filter((crop: any) => Boolean(crop.organic)).length,
      },
      filters: {
        query,
        state,
        district,
        category,
        verified_only: verifiedOnly,
        price_min: Number.isFinite(priceMin) ? priceMin : null,
        price_max: Number.isFinite(priceMax) ? priceMax : null,
        sort,
      },
    });
  }

  async farmerProfile(farmerId: string) {
    if (!isValidObjectId(farmerId)) {
      fail('Farmer not found', 'farmer_not_found', HttpStatus.NOT_FOUND);
    }

    const farmer = await this.userModel.findOne({ _id: farmerId, role: 'farmer' });
    if (!farmer) {
      fail('Farmer not found', 'farmer_not_found', HttpStatus.NOT_FOUND);
    }

    const crops = await this.cropModel.find({ farmer: farmer._id }).sort({ created_at: -1 }).populate('farmer');
    const reviews = await this.reviewModel.find({ farmer: farmer._id }).sort({ created_at: -1 }).populate('customer');
    const avgRating = reviews.length === 0 ? 0 : reviews.reduce((sum: number, review: any) => sum + Number(review.rating || 0), 0) / reviews.length;

    return ok('Farmer profile loaded', {
      farmer: {
        ...serializeUser(farmer),
        trust_score: farmer.is_verified ? 92 : 74,
      },
      crops: crops.map((crop: any) => serializeCrop(crop)),
      reviews: reviews.map((review: any) => serializeReview(review)),
      avg_rating: Number(avgRating.toFixed(2)) || 0,
    });
  }

  async farmerDashboard(user: any) {
    const crops = await this.cropModel.find({ farmer: user._id }).sort({ created_at: -1 }).populate('farmer');
    const cropIds = crops.map((crop: any) => crop._id);
    const orders = cropIds.length
      ? await this.orderModel
          .find({ crop: { $in: cropIds } })
          .sort({ order_date: -1 })
          .populate('customer')
          .populate({ path: 'crop', populate: { path: 'farmer' } })
      : [];

    const serializedCrops = crops.map((crop: any) => serializeCrop(crop));
    const serializedOrders = orders.map((order: any) => serializeFarmerDashboardOrder(order));
    const totalRevenue = serializedOrders.reduce((sum: number, order: any) => sum + Number(order.total_price || 0), 0);
    const lowStockCount = serializedCrops.filter((crop: any) => String(crop.stock_status) === 'Low Stock').length;
    const liveStock = serializedCrops.reduce((sum: number, crop: any) => sum + Number(crop.quantity || 0), 0);

    const topSellingMap = new Map<string, { crop_name: string; total_quantity: number; total_revenue: number }>();
    serializedOrders.forEach((order: any) => {
      const current = topSellingMap.get(order.crop_name) || { crop_name: order.crop_name, total_quantity: 0, total_revenue: 0 };
      current.total_quantity += Number(order.quantity || 0);
      current.total_revenue += Number(order.total_price || 0);
      topSellingMap.set(order.crop_name, current);
    });

    const hotspotMap = new Map<string, { area: string; orders: number }>();
    serializedOrders.forEach((order: any) => {
      const area = [order.customer_district, order.customer_state].filter(Boolean).join(', ') || 'Unknown area';
      const current = hotspotMap.get(area) || { area, orders: 0 };
      current.orders += 1;
      hotspotMap.set(area, current);
    });

    const smartAlerts: Array<{ level: string; title: string; body: string }> = [];
    if (!user.is_verified) {
      smartAlerts.push({
        level: 'warning',
        title: 'Verification pending',
        body: 'Complete farmer verification to improve ranking and trust in the marketplace.',
      });
    }
    if (lowStockCount > 0) {
      smartAlerts.push({
        level: 'warning',
        title: 'Low stock attention',
        body: `${lowStockCount} listing${lowStockCount === 1 ? '' : 's'} are close to stock-out. Refresh quantities to keep buyer confidence high.`,
      });
    }
    if (serializedOrders.filter((order: any) => order.payment_status !== 'confirmed').length > 0) {
      smartAlerts.push({
        level: 'info',
        title: 'Pending payment confirmations',
        body: 'Watch buyer payment confirmations and keep chat open for faster order conversion.',
      });
    }

    return ok('Farmer dashboard loaded', {
      crops: serializedCrops,
      orders: serializedOrders,
      is_verified: Boolean(user.is_verified),
      metrics: {
        total_listings: serializedCrops.length,
        live_stock: Number(liveStock.toFixed(2)),
        total_orders: serializedOrders.length,
        total_revenue: Number(totalRevenue.toFixed(2)),
        pending_orders: serializedOrders.filter((order: any) => !['Delivered', 'Cancelled'].includes(String(order.status))).length,
        low_stock_count: lowStockCount,
      },
      top_selling_crops: [...topSellingMap.values()].sort((left, right) => right.total_revenue - left.total_revenue).slice(0, 5),
      demand_hotspots: [...hotspotMap.values()].sort((left, right) => right.orders - left.orders).slice(0, 6),
      smart_alerts: smartAlerts,
    });
  }

  async createCrop(user: any, body: Record<string, unknown>, files: Record<string, UploadedFile[] | undefined>) {
    const image = files.image?.[0];
    const qualityProof = files.quality_proof?.[0];

    if (this.fileTooLarge(image)) {
      await this.cleanupUploadedFiles(files);
      fail('Crop image too large (Max 2MB)', 'image_too_large');
    }
    if (this.fileTooLarge(qualityProof)) {
      await this.cleanupUploadedFiles(files);
      fail('Quality proof too large (Max 2MB)', 'proof_too_large');
    }

    const quantity = this.toNumber(body.quantity);
    const minOrderQuantity = Math.max(this.toNumber(body.min_order_quantity, 1), 0.1);
    const crop = await this.cropModel.create({
      farmer: user._id,
      name: String(body.name || ''),
      category: String(body.category || 'Others'),
      quantity,
      price: this.toNumber(body.price),
      harvest_date: this.toDate(body.harvest_date),
      state: String(body.state || user.state || ''),
      district: String(body.district || user.district || ''),
      village: String(body.village || ''),
      pincode: String(body.pincode || user.pincode || ''),
      description: String(body.description || ''),
      quality: String(body.quality || 'Standard'),
      image: this.relativeUploadPath(image),
      quality_proof: this.relativeUploadPath(qualityProof),
      unit: String(body.unit || 'kg'),
      min_order_quantity: minOrderQuantity,
      same_day_available: this.toBoolean(body.same_day_available),
      organic: this.toBoolean(body.organic),
      demand_score: this.toNumber(body.demand_score, 50),
      price_trend: String(body.price_trend || 'Stable'),
      stock_status: this.computeStockStatus(quantity, minOrderQuantity),
      latitude: this.toNullableNumber(body.latitude),
      longitude: this.toNullableNumber(body.longitude),
      delivery_radius_km: this.toNumber(body.delivery_radius_km, 30),
      tags: this.parseTags(body.tags),
    });

    const populatedCrop = await this.cropModel.findById(crop._id).populate('farmer');
    return ok('Crop added successfully!', { crop: serializeCrop(populatedCrop || crop) });
  }

  async cropDetail(user: any, cropId: string) {
    const crop = await this.getCropForUser(cropId, user);
    if (!crop) {
      fail('Crop not found or unauthorized', 'crop_not_found', HttpStatus.NOT_FOUND);
    }
    return ok('Crop loaded', { crop: serializeCrop(crop) });
  }

  async updateCrop(user: any, cropId: string, body: Record<string, unknown>, files: Record<string, UploadedFile[] | undefined> = {}) {
    const crop: any = await this.getCropForUser(cropId, user);
    if (!crop) {
      await this.cleanupUploadedFiles(files);
      fail('Crop not found or unauthorized', 'crop_not_found', HttpStatus.NOT_FOUND);
    }

    const image = files.image?.[0];
    const qualityProof = files.quality_proof?.[0];
    if (this.fileTooLarge(image)) {
      await this.cleanupUploadedFiles(files);
      fail('Crop image too large (Max 2MB)', 'image_too_large');
    }
    if (this.fileTooLarge(qualityProof)) {
      await this.cleanupUploadedFiles(files);
      fail('Quality proof too large (Max 2MB)', 'proof_too_large');
    }

    const previousImage = String(crop.image || '');
    const previousProof = String(crop.quality_proof || '');

    if (body.name !== undefined) crop.name = String(body.name || crop.name);
    if (body.category !== undefined) crop.category = String(body.category || crop.category);
    if (body.quantity !== undefined) crop.quantity = this.toNumber(body.quantity, crop.quantity);
    if (body.price !== undefined) crop.price = this.toNumber(body.price, crop.price);
    if (body.description !== undefined) crop.description = String(body.description || '');
    if (body.state !== undefined) crop.state = String(body.state || crop.state || '');
    if (body.district !== undefined) crop.district = String(body.district || crop.district || '');
    if (body.village !== undefined) crop.village = String(body.village || crop.village || '');
    if (body.pincode !== undefined) crop.pincode = String(body.pincode || crop.pincode || '');
    if (body.unit !== undefined) crop.unit = String(body.unit || crop.unit || 'kg');
    if (body.min_order_quantity !== undefined) crop.min_order_quantity = Math.max(this.toNumber(body.min_order_quantity, crop.min_order_quantity || 1), 0.1);
    if (body.same_day_available !== undefined) crop.same_day_available = this.toBoolean(body.same_day_available);
    if (body.organic !== undefined) crop.organic = this.toBoolean(body.organic);
    if (body.demand_score !== undefined) crop.demand_score = this.toNumber(body.demand_score, crop.demand_score || 50);
    if (body.price_trend !== undefined) crop.price_trend = String(body.price_trend || crop.price_trend || 'Stable');
    if (body.latitude !== undefined) crop.latitude = this.toNullableNumber(body.latitude);
    if (body.longitude !== undefined) crop.longitude = this.toNullableNumber(body.longitude);
    if (body.delivery_radius_km !== undefined) crop.delivery_radius_km = this.toNumber(body.delivery_radius_km, crop.delivery_radius_km || 30);
    if (body.tags !== undefined) crop.tags = this.parseTags(body.tags);
    if (image) {
      crop.image = this.relativeUploadPath(image);
    }
    if (qualityProof) {
      crop.quality_proof = this.relativeUploadPath(qualityProof);
    }
    crop.stock_status = this.computeStockStatus(Number(crop.quantity || 0), Number(crop.min_order_quantity || 1));

    await crop.save();
    await Promise.all([
      this.cleanupReplacedFile(previousImage, crop.image),
      this.cleanupReplacedFile(previousProof, crop.quality_proof),
    ]);
    return ok('Crop updated successfully!', { crop: serializeCrop(crop) });
  }

  async deleteCrop(user: any, cropId: string) {
    const crop: any = await this.getCropForUser(cropId, user);
    if (!crop) {
      fail('Crop not found or unauthorized', 'crop_not_found', HttpStatus.NOT_FOUND);
    }

    const orders = await this.orderModel.find({ crop: crop._id }).select('_id').lean();
    const orderIds = orders.map((order: any) => asIdString(order._id));

    if (orderIds.length > 0) {
      await this.orderUpdateModel.deleteMany({ order: { $in: orderIds } });
      await this.reviewModel.deleteMany({ order: { $in: orderIds } });
      await this.orderModel.deleteMany({ _id: { $in: orderIds } });
    }

    await crop.deleteOne();
    return ok('Crop deleted successfully');
  }

  private async getCropForUser(cropId: string, user: any) {
    if (!isValidObjectId(cropId)) {
      return null;
    }
    const crop: any = await this.cropModel.findById(cropId).populate('farmer');
    if (!crop) {
      return null;
    }
    if (user.role === 'admin') {
      return crop;
    }
    const farmerId = asIdString(crop.farmer?._id || crop.farmer);
    return farmerId === asIdString(user._id) ? crop : null;
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private toDate(value: unknown): Date | null {
    const text = String(value || '').trim();
    if (!text) {
      return null;
    }
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private toNumber(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private toNullableNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
  }

  private parseTags(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    return String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
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

  private fileTooLarge(file?: UploadedFile): boolean {
    return Boolean(file && file.size > 2 * 1024 * 1024);
  }

  private relativeUploadPath(file?: UploadedFile): string {
    return file ? `uploads/${file.filename}` : '';
  }

  private async cleanupReplacedFile(previousPath: string, nextPath: string): Promise<void> {
    if (!previousPath || previousPath === nextPath || !previousPath.startsWith('uploads/')) {
      return;
    }
    try {
      const relative = previousPath.replace(/^uploads\//, '');
      await fs.unlink(`${env.uploadsRoot}/${relative}`);
    } catch {
      // ignore cleanup failures
    }
  }

  private async cleanupUploadedFiles(files: Record<string, UploadedFile[] | undefined>): Promise<void> {
    const allFiles = Object.values(files).flat().filter(Boolean) as UploadedFile[];
    await Promise.all(
      allFiles.map(async (file) => {
        if (!file.path) {
          return;
        }
        try {
          await fs.unlink(file.path);
        } catch {
          // ignore cleanup failures
        }
      }),
    );
  }
}

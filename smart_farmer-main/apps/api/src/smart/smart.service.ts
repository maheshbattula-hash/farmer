import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { User } from '../auth/schemas/user.schema';
import { ADVISORY_LIBRARY } from '../common/constants';
import { ok, fail } from '../common/http-response';
import {
  serializeDiseaseReport,
  serializeIrrigationPlan,
  serializeNotification,
  serializeUser,
} from '../common/serializers';
import { asIdString, isValidObjectId } from '../common/utils/ids';
import { Crop } from '../marketplace/schemas/crop.schema';
import { Order } from '../orders/schemas/order.schema';
import { Review } from '../reviews/schemas/review.schema';

import { DiseaseReport } from './schemas/disease-report.schema';
import { IrrigationPlan } from './schemas/irrigation-plan.schema';
import { Notification } from './schemas/notification.schema';

@Injectable()
export class SmartService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Crop.name) private readonly cropModel: Model<Crop>,
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(Review.name) private readonly reviewModel: Model<Review>,
    @InjectModel(Notification.name) private readonly notificationModel: Model<Notification>,
    @InjectModel(DiseaseReport.name) private readonly diseaseReportModel: Model<DiseaseReport>,
    @InjectModel(IrrigationPlan.name) private readonly irrigationPlanModel: Model<IrrigationPlan>,
  ) {}

  async overview(user: any) {
    const [analytics, forecast, notifications, advisories, diseaseReports, irrigationPlans, nearbyBuyers] = await Promise.all([
      this.buildAnalytics(user),
      this.buildMarketForecast(user, {}),
      this.notificationModel.find({ user: user._id }).sort({ created_at: -1 }).limit(6).lean(),
      this.buildAdvisories(user, {}),
      this.diseaseReportModel.find({ user: user._id }).sort({ created_at: -1 }).limit(3).lean(),
      this.irrigationPlanModel.find({ user: user._id }).sort({ created_at: -1 }).limit(3).lean(),
      user.role === 'farmer' ? this.computeNearbyBuyers(user) : Promise.resolve([]),
    ]);

    return ok('Smart hub loaded', {
      role: user.role,
      analytics,
      market_forecast: forecast,
      notifications: notifications.map((item: any) => serializeNotification(item)),
      advisories,
      disease_reports: diseaseReports.map((item: any) => serializeDiseaseReport(item)),
      irrigation_plans: irrigationPlans.map((item: any) => serializeIrrigationPlan(item)),
      nearby_buyers: nearbyBuyers,
    });
  }

  async analytics(user: any) {
    return ok('Analytics loaded', {
      analytics: await this.buildAnalytics(user),
    });
  }

  async marketForecast(user: any, query: Record<string, unknown>) {
    return ok('Market forecast loaded', {
      market_forecast: await this.buildMarketForecast(user, query),
    });
  }

  async advisory(user: any, query: Record<string, unknown>) {
    return ok('Advisory loaded', {
      advisories: await this.buildAdvisories(user, query),
    });
  }

  async notifications(user: any) {
    const notifications = await this.notificationModel.find({ user: user._id }).sort({ created_at: -1 }).limit(50).lean();
    return ok('Notifications loaded', {
      notifications: notifications.map((item: any) => serializeNotification(item)),
      unread_count: notifications.filter((item: any) => !item.read_at).length,
    });
  }

  async markNotificationRead(user: any, notificationId: string) {
    if (!isValidObjectId(notificationId)) {
      fail('Notification not found', 'notification_not_found', HttpStatus.NOT_FOUND);
    }
    const notification = await this.notificationModel.findOneAndUpdate(
      { _id: notificationId, user: user._id },
      { read_at: new Date() },
      { new: true },
    );
    if (!notification) {
      fail('Notification not found', 'notification_not_found', HttpStatus.NOT_FOUND);
    }
    return ok('Notification updated', { notification: serializeNotification(notification) });
  }

  async registerPushToken(user: any, body: Record<string, unknown>) {
    const token = String(body.push_token || '').trim();
    if (!token) {
      fail('Push token is required.', 'push_token_required');
    }
    const userDoc: any = await this.userModel.findById(user._id);
    if (!userDoc) {
      fail('User not found', 'user_not_found', HttpStatus.NOT_FOUND);
    }
    userDoc.push_token = token;
    await userDoc.save();
    return ok('Push token registered successfully.', { user: serializeUser(userDoc) });
  }

  async updateLocation(user: any, body: Record<string, unknown>) {
    const userDoc: any = await this.userModel.findById(user._id);
    if (!userDoc) {
      fail('User not found', 'user_not_found', HttpStatus.NOT_FOUND);
    }

    if (body.latitude !== undefined) {
      userDoc.latitude = this.toNullableNumber(body.latitude);
    }
    if (body.longitude !== undefined) {
      userDoc.longitude = this.toNullableNumber(body.longitude);
    }
    if (body.city !== undefined) {
      userDoc.city = String(body.city || userDoc.city || '');
    }
    if (body.district !== undefined) {
      userDoc.district = String(body.district || userDoc.district || '');
    }
    if (body.state !== undefined) {
      userDoc.state = String(body.state || userDoc.state || '');
    }
    if (body.pincode !== undefined) {
      userDoc.pincode = String(body.pincode || userDoc.pincode || '');
    }
    if (body.preferred_language !== undefined) {
      userDoc.preferred_language = String(body.preferred_language || userDoc.preferred_language || 'en');
    }
    if (body.voice_enabled !== undefined) {
      userDoc.voice_enabled = this.toBoolean(body.voice_enabled);
    }
    await userDoc.save();

    return ok('Location updated successfully.', {
      user: serializeUser(userDoc),
      nearby_buyers: userDoc.role === 'farmer' ? await this.computeNearbyBuyers(userDoc) : [],
    });
  }

  async diseasePredict(user: any, body: Record<string, unknown>, file?: { filename?: string; originalname?: string; size?: number }) {
    const cropName = String(body.crop_name || user.primary_crop || 'Crop').trim() || 'Crop';
    const symptoms = String(body.symptoms || '').trim();
    const humidity = this.toNumber(body.humidity, 65);
    const soilMoisture = this.toNumber(body.soil_moisture, 45);
    const temperature = this.toNumber(body.temperature_c, 28);
    const uploadedImagePath = file?.filename ? `uploads/${file.filename}` : '';
    const imageName = String(body.image_name || file?.originalname || file?.filename || '').trim();
    const region = [String(body.district || user.district || '').trim(), String(body.state || user.state || '').trim()].filter(Boolean).join(', ');

    if (file?.size && file.size > 2 * 1024 * 1024) {
      fail('Disease image too large (Max 2MB)', 'image_too_large');
    }

    let predictedDisease = 'Healthy canopy';
    let riskLevel = 'Low';
    let recommendation = 'Continue standard scouting and maintain balanced watering.';
    let confidence = 78;

    const symptomText = symptoms.toLowerCase();
    const imageSignal = `${imageName} ${symptoms}`.toLowerCase();
    if (symptomText.includes('spot') || symptomText.includes('blight') || humidity >= 78 || imageSignal.includes('spot')) {
      predictedDisease = cropName.toLowerCase().includes('tomato') ? 'Early blight risk' : 'Leaf spot risk';
      riskLevel = 'High';
      recommendation = 'Remove infected leaves, reduce overhead irrigation, and apply crop-safe preventive fungicide guidance.';
      confidence = uploadedImagePath ? 91 : 88;
    } else if (symptomText.includes('yellow') || symptomText.includes('curl') || temperature > 34 || imageSignal.includes('yellow')) {
      predictedDisease = 'Heat and nutrient stress';
      riskLevel = 'Medium';
      recommendation = 'Increase early-morning irrigation, review micronutrient balance, and scout for sucking pests.';
      confidence = uploadedImagePath ? 85 : 82;
    } else if (soilMoisture > 82 || imageSignal.includes('rot')) {
      predictedDisease = 'Root rot pressure';
      riskLevel = 'High';
      recommendation = 'Reduce irrigation frequency, improve drainage, and keep the root zone aerated.';
      confidence = uploadedImagePath ? 89 : 86;
    }

    const report = await this.diseaseReportModel.create({
      user: user._id,
      crop_name: cropName,
      symptoms,
      image_name: imageName,
      image_path: uploadedImagePath,
      risk_level: riskLevel,
      predicted_disease: predictedDisease,
      recommendation,
      confidence,
      region,
    });

    await this.notificationModel.create({
      user: user._id,
      title: 'Disease scan completed',
      body: `${cropName}: ${predictedDisease} (${riskLevel} risk).`,
      category: 'disease',
      meta: { report_id: asIdString(report._id) },
    });

    return ok('Disease prediction ready', { report: serializeDiseaseReport(report) });
  }

  async irrigationRecommend(user: any, body: Record<string, unknown>) {
    const cropName = String(body.crop_name || user.primary_crop || 'Crop').trim() || 'Crop';
    const soilMoisture = this.toNumber(body.soil_moisture, 45);
    const rainfall = this.toNumber(body.rainfall_mm, 0);
    const temperature = this.toNumber(body.temperature_c, 28);

    let recommendation = 'Maintain current watering schedule.';
    let nextWateringWindow = 'Review tomorrow morning';
    let savingPercent = 12;
    let automationReady = false;

    if (soilMoisture <= 28 && rainfall < 5) {
      recommendation = 'Irrigate in the next cycle with a moderate pulse and recheck moisture after 6 hours.';
      nextWateringWindow = 'Today 6pm-8pm';
      savingPercent = 18;
      automationReady = true;
    } else if (soilMoisture >= 72 || rainfall >= 12) {
      recommendation = 'Skip the next irrigation cycle and allow the field to drain naturally.';
      nextWateringWindow = 'Pause for 24 hours';
      savingPercent = 31;
      automationReady = true;
    } else if (temperature >= 35) {
      recommendation = 'Shift watering to early morning and avoid midday loss from evaporation.';
      nextWateringWindow = 'Tomorrow 5am-7am';
      savingPercent = 22;
    }

    const plan = await this.irrigationPlanModel.create({
      user: user._id,
      crop_name: cropName,
      soil_moisture: soilMoisture,
      rainfall_mm: rainfall,
      temperature_c: temperature,
      recommendation,
      next_watering_window: nextWateringWindow,
      water_saving_percent: savingPercent,
      automation_ready: automationReady,
    });

    await this.notificationModel.create({
      user: user._id,
      title: 'Irrigation plan updated',
      body: `${cropName}: ${nextWateringWindow}.`,
      category: 'irrigation',
      meta: { plan_id: asIdString(plan._id) },
    });

    return ok('Irrigation recommendation ready', { plan: serializeIrrigationPlan(plan) });
  }

  private async buildAnalytics(user: any) {
    const scopedData = await this.loadScopedData(user, true);
    const totalRevenue = scopedData.orders
      .filter((order: any) => order.payment_status === 'confirmed')
      .reduce((sum: number, order: any) => sum + Number(order.total_price || 0), 0);
    const averageOrderValue = scopedData.orders.length ? totalRevenue / Math.max(scopedData.orders.length, 1) : 0;

    const topSellingMap = new Map<string, { crop_name: string; orders: number; quantity: number; revenue: number }>();
    scopedData.orders.forEach((order: any) => {
      const cropName = String(order.crop?.name || 'Crop');
      const current = topSellingMap.get(cropName) || { crop_name: cropName, orders: 0, quantity: 0, revenue: 0 };
      current.orders += 1;
      current.quantity += Number(order.quantity || 0);
      current.revenue += Number(order.total_price || 0);
      topSellingMap.set(cropName, current);
    });

    const buyerDemandMap = new Map<string, { area: string; orders: number; revenue: number }>();
    scopedData.orders.forEach((order: any) => {
      const area = [order.customer?.district, order.customer?.state].filter(Boolean).join(', ') || 'Unknown area';
      const current = buyerDemandMap.get(area) || { area, orders: 0, revenue: 0 };
      current.orders += 1;
      current.revenue += Number(order.total_price || 0);
      buyerDemandMap.set(area, current);
    });

    const diseaseAlerts = new Map<string, number>();
    scopedData.diseaseReports.forEach((report: any) => {
      const region = String(report.region || 'Unknown region');
      diseaseAlerts.set(region, (diseaseAlerts.get(region) || 0) + 1);
    });

    const waterUsage = {
      plans_count: scopedData.irrigationPlans.length,
      avg_saving_percent: scopedData.irrigationPlans.length
        ? Number((scopedData.irrigationPlans.reduce((sum: number, item: any) => sum + Number(item.water_saving_percent || 0), 0) / scopedData.irrigationPlans.length).toFixed(1))
        : 0,
      estimated_savings_litres: Number((scopedData.irrigationPlans.reduce((sum: number, item: any) => sum + Number(item.water_saving_percent || 0) * 120, 0)).toFixed(0)),
    };

    const priceTrendCharts = scopedData.crops.slice(0, 8).map((crop: any) => {
      const demandIndex = Math.max(30, Math.min(95, Math.round(Number(crop.demand_score || 50) + this.countOrdersForCrop(scopedData.orders, asIdString(crop._id)) * 3)));
      const projectedPrice7d = Number((Number(crop.price || 0) * (1 + (demandIndex - 50) / 220)).toFixed(2));
      return {
        crop_name: crop.name,
        current_price: Number(Number(crop.price || 0).toFixed(2)),
        projected_price_7d: projectedPrice7d,
        demand_index: demandIndex,
        trend: demandIndex > 65 ? 'Rising' : demandIndex < 45 ? 'Soft' : 'Stable',
      };
    });

    return {
      sales_summary: {
        total_revenue: Number(totalRevenue.toFixed(2)),
        total_orders: scopedData.orders.length,
        paid_orders: scopedData.orders.filter((order: any) => order.payment_status === 'confirmed').length,
        active_orders: scopedData.orders.filter((order: any) => !['Delivered', 'Cancelled'].includes(String(order.status))).length,
        average_order_value: Number(averageOrderValue.toFixed(2)) || 0,
      },
      top_selling_crops: [...topSellingMap.values()].sort((left, right) => right.quantity - left.quantity).slice(0, 5),
      buyer_demand_by_area: [...buyerDemandMap.values()].sort((left, right) => right.orders - left.orders).slice(0, 6),
      price_trend_charts: priceTrendCharts,
      water_usage_reports: waterUsage,
      disease_alerts_by_region: [...diseaseAlerts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6).map(([region, alerts]) => ({ region, alerts })),
      verified_farmers: scopedData.users.filter((item: any) => item.role === 'farmer' && item.is_verified).length,
    };
  }

  private async buildMarketForecast(user: any, query: Record<string, unknown>) {
    const cropNameFilter = String(query.crop_name || '').trim().toLowerCase();
    const scopedData = await this.loadScopedData(user, true);
    const relevantCrops = scopedData.crops.filter((crop: any) => !cropNameFilter || String(crop.name || '').toLowerCase().includes(cropNameFilter));

    const grouped = new Map<string, any[]>();
    relevantCrops.forEach((crop: any) => {
      const key = String(crop.name || 'Crop');
      const bucket = grouped.get(key) || [];
      bucket.push(crop);
      grouped.set(key, bucket);
    });

    const forecasts = [...grouped.entries()].map(([name, crops]) => {
      const averagePrice = crops.reduce((sum: number, crop: any) => sum + Number(crop.price || 0), 0) / Math.max(crops.length, 1);
      const avgDemandScore = crops.reduce((sum: number, crop: any) => sum + Number(crop.demand_score || 50), 0) / Math.max(crops.length, 1);
      const orderCount = scopedData.orders.filter((order: any) => String(order.crop?.name || '') === name).length;
      const demandIndex = Math.max(30, Math.min(95, Math.round(avgDemandScore + orderCount * 3)));
      const projectedPrice7d = Number((averagePrice * (1 + (demandIndex - 50) / 220)).toFixed(2));
      const projectedPrice30d = Number((averagePrice * (1 + (demandIndex - 50) / 160)).toFixed(2));
      const trend = demandIndex >= 68 ? 'Rising' : demandIndex <= 42 ? 'Soft' : 'Stable';
      return {
        crop_name: name,
        current_price: Number(averagePrice.toFixed(2)),
        projected_price_7d: projectedPrice7d,
        projected_price_30d: projectedPrice30d,
        demand_index: demandIndex,
        trend,
        recommendation:
          trend === 'Rising'
            ? 'Hold premium lots or release inventory in batches.'
            : trend === 'Soft'
              ? 'List competitively and prioritize faster delivery promises.'
              : 'Maintain steady pricing and watch for district-level demand spikes.',
      };
    });

    return forecasts.sort((left, right) => right.demand_index - left.demand_index).slice(0, 8);
  }

  private async buildAdvisories(user: any, query: Record<string, unknown>) {
    const requestedCrop = String(query.crop_name || user.primary_crop || '').trim().toLowerCase();
    const cropKey = requestedCrop && ADVISORY_LIBRARY[requestedCrop] ? requestedCrop : 'general';
    const tips = ADVISORY_LIBRARY[cropKey] || ADVISORY_LIBRARY.general;
    const extras = [] as string[];

    if (user.role === 'farmer') {
      extras.push('Review buyer messages twice a day to reduce order drop-off.');
      extras.push('Enable verified badge and keep live stock updated for better marketplace ranking.');
    }
    if (user.role === 'customer') {
      extras.push('Use district and verification filters to find reliable local produce faster.');
    }

    return [...tips, ...extras].slice(0, 6).map((tip, index) => ({
      id: `${cropKey}-${index + 1}`,
      title: index === 0 ? `${(requestedCrop || cropKey || 'General').replace(/\b\w/g, (letter) => letter.toUpperCase())} advisory` : 'Best-practice tip',
      body: tip,
      crop: requestedCrop || cropKey,
    }));
  }

  private async loadScopedData(user: any, includeGlobalForecastData = false) {
    let crops: any[] = [];
    let orders: any[] = [];
    let users: any[] = [];
    let diseaseReports: any[] = [];
    let irrigationPlans: any[] = [];

    if (user.role === 'farmer') {
      crops = await this.cropModel.find({ farmer: user._id }).sort({ created_at: -1 }).lean();
      const cropIds = crops.map((crop: any) => crop._id);
      orders = cropIds.length
        ? await this.orderModel.find({ crop: { $in: cropIds } }).populate('customer').populate('crop').lean()
        : [];
      users = await this.userModel.find({ role: { $in: ['farmer', 'customer'] } }).lean();
      diseaseReports = await this.diseaseReportModel.find({ user: user._id }).lean();
      irrigationPlans = await this.irrigationPlanModel.find({ user: user._id }).lean();
      if (includeGlobalForecastData && crops.length < 4) {
        const extraCrops = await this.cropModel.find().sort({ created_at: -1 }).limit(40).lean();
        crops = this.mergeById(crops, extraCrops);
      }
    } else if (user.role === 'customer') {
      orders = await this.orderModel.find({ customer: user._id }).populate('customer').populate('crop').lean();
      crops = includeGlobalForecastData ? await this.cropModel.find().sort({ created_at: -1 }).limit(40).lean() : await this.cropModel.find().sort({ created_at: -1 }).limit(12).lean();
      users = await this.userModel.find({ role: { $in: ['farmer', 'customer'] } }).lean();
      diseaseReports = await this.diseaseReportModel.find({ user: user._id }).lean();
      irrigationPlans = await this.irrigationPlanModel.find({ user: user._id }).lean();
    } else {
      crops = await this.cropModel.find().sort({ created_at: -1 }).limit(includeGlobalForecastData ? 120 : 60).lean();
      orders = await this.orderModel.find().populate('customer').populate('crop').lean();
      users = await this.userModel.find().lean();
      diseaseReports = await this.diseaseReportModel.find().lean();
      irrigationPlans = await this.irrigationPlanModel.find().lean();
    }

    return { crops, orders, users, diseaseReports, irrigationPlans };
  }

  private async computeNearbyBuyers(user: any) {
    const buyers = await this.userModel.find({ role: 'customer' }).sort({ created_at: -1 }).limit(100).lean();
    const buyerIds = buyers.map((buyer: any) => buyer._id);
    const orders = buyerIds.length ? await this.orderModel.find({ customer: { $in: buyerIds } }).sort({ order_date: -1 }).lean() : [];

    const byBuyer = new Map<string, { buyer: any; orders: number; last_order_date: Date | null; distance_km: number | null }>();

    buyers.forEach((buyer: any) => {
      const sameDistrict = user.district && buyer.district && user.district === buyer.district;
      const sameState = user.state && buyer.state && user.state === buyer.state;
      const distance = this.distanceKm(user.latitude, user.longitude, buyer.latitude, buyer.longitude);
      const eligible = sameDistrict || sameState || (distance !== null && distance <= 120);
      if (!eligible) {
        return;
      }
      byBuyer.set(asIdString(buyer._id), {
        buyer,
        orders: 0,
        last_order_date: null,
        distance_km: distance,
      });
    });

    orders.forEach((order: any) => {
      const key = asIdString(order.customer);
      const bucket = byBuyer.get(key);
      if (!bucket) {
        return;
      }
      bucket.orders += 1;
      if (!bucket.last_order_date || new Date(order.order_date).getTime() > bucket.last_order_date.getTime()) {
        bucket.last_order_date = order.order_date ? new Date(order.order_date) : null;
      }
    });

    return [...byBuyer.values()]
      .sort((left, right) => (right.orders - left.orders) || this.compareNullableNumbers(left.distance_km, right.distance_km))
      .slice(0, 12)
      .map((entry) => ({
        ...serializeUser(entry.buyer),
        orders: entry.orders,
        last_order_date: entry.last_order_date,
        distance_km: entry.distance_km !== null ? Number(entry.distance_km.toFixed(1)) : null,
      }));
  }

  private countOrdersForCrop(orders: any[], cropId: string) {
    return orders.filter((order: any) => asIdString(order.crop?._id || order.crop) === cropId).length;
  }

  private mergeById(left: any[], right: any[]) {
    const seen = new Set(left.map((item: any) => asIdString(item._id)));
    const merged = [...left];
    right.forEach((item: any) => {
      const key = asIdString(item._id);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    });
    return merged;
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
  }

  private toNumber(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private toNullableNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private compareNullableNumbers(left: number | null, right: number | null) {
    if (left === null && right === null) {
      return 0;
    }
    if (left === null) {
      return 1;
    }
    if (right === null) {
      return -1;
    }
    return left - right;
  }

  private distanceKm(latitudeA: number | null, longitudeA: number | null, latitudeB: number | null, longitudeB: number | null) {
    if ([latitudeA, longitudeA, latitudeB, longitudeB].some((value) => typeof value !== 'number' || Number.isNaN(value))) {
      return null;
    }
    const earthRadiusKm = 6371;
    const dLat = this.toRadians((latitudeB as number) - (latitudeA as number));
    const dLon = this.toRadians((longitudeB as number) - (longitudeA as number));
    const lat1 = this.toRadians(latitudeA as number);
    const lat2 = this.toRadians(latitudeB as number);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }

  private toRadians(value: number) {
    return (value * Math.PI) / 180;
  }
}

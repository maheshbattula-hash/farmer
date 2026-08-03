import { ORDER_STAGES } from './constants';
import { formatDateOnly, formatDateTime } from './utils/format';
import { asIdString } from './utils/ids';

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? (value as Record<string, any>) : {};
}

function getField(value: unknown, field: string): string {
  const record = asRecord(value);
  const raw = record[field];
  return raw === undefined || raw === null ? '' : String(raw);
}

function getNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function getObject(value: unknown, field: string): Record<string, unknown> {
  const record = asRecord(value);
  const nested = record[field];
  return nested && typeof nested === 'object' ? (nested as Record<string, unknown>) : {};
}

function mediaField(value: unknown, primaryField: string, fallbackField = ''): string {
  const record = asRecord(value);
  const primary = getField(record, primaryField);
  if (primary) {
    return primary;
  }
  if (fallbackField) {
    const fallback = getField(record, fallbackField);
    if (fallback.startsWith('uploads/')) {
      return fallback;
    }
  }
  return '';
}

function computeStockStatus(quantity: number, minOrderQuantity: number): string {
  if (quantity <= 0) {
    return 'Out of Stock';
  }
  if (quantity <= Math.max(minOrderQuantity * 2, 10)) {
    return 'Low Stock';
  }
  return 'Available';
}

function deliveryEta(crop: Record<string, any>, farmer: Record<string, any>): string {
  if (Boolean(crop.same_day_available)) {
    return 'Same day dispatch';
  }
  if (farmer.city && crop.district && farmer.city === crop.district) {
    return 'Within 24 hours';
  }
  if (farmer.state && crop.state && farmer.state === crop.state) {
    return '2-3 days';
  }
  return '3-5 days';
}

function stageIndex(updates: unknown[], status: string): number {
  const seen = new Set(updates.map((update) => getField(update, 'status')));
  let currentIndex = 0;
  ORDER_STAGES.forEach((stage, index) => {
    if (seen.has(stage)) {
      currentIndex = index;
    }
  });
  const directIndex = ORDER_STAGES.indexOf(status);
  return directIndex > currentIndex ? directIndex : currentIndex;
}

export function serializeUser(user: unknown) {
  const record = asRecord(user);
  return {
    id: asIdString(record._id),
    username: getField(record, 'username'),
    email: getField(record, 'email'),
    role: getField(record, 'role'),
    full_name: getField(record, 'full_name'),
    contact: getField(record, 'contact'),
    city: getField(record, 'city'),
    state: getField(record, 'state'),
    district: getField(record, 'district'),
    pincode: getField(record, 'pincode'),
    latitude: record.latitude ?? null,
    longitude: record.longitude ?? null,
    is_verified: Boolean(record.is_verified),
    preferred_language: getField(record, 'preferred_language') || 'en',
    voice_enabled: Boolean(record.voice_enabled),
    push_token: getField(record, 'push_token'),
    farm_size: getField(record, 'farm_size'),
    primary_crop: getField(record, 'primary_crop'),
    trust_score: Boolean(record.is_verified) ? 92 : 74,
  };
}

export function serializeCrop(crop: unknown) {
  const record = asRecord(crop);
  const farmer = asRecord(record.farmer);
  const quantity = getNumber(record.quantity);
  const minOrderQuantity = Math.max(getNumber(record.min_order_quantity, 1), 0.1);
  return {
    id: asIdString(record._id),
    farmer_id: asIdString(farmer._id || record.farmer),
    name: getField(record, 'name'),
    category: getField(record, 'category'),
    quantity,
    price: getNumber(record.price),
    harvest_date: record.harvest_date || null,
    state: getField(record, 'state'),
    district: getField(record, 'district'),
    village: getField(record, 'village'),
    pincode: getField(record, 'pincode'),
    description: getField(record, 'description'),
    image_url: mediaField(record, 'image'),
    image: getField(record, 'image'),
    quality: getField(record, 'quality'),
    quality_proof: getField(record, 'quality_proof'),
    farmer_name: getField(farmer, 'full_name') || getField(farmer, 'username'),
    farmer_city: getField(farmer, 'city'),
    is_verified: Boolean(farmer.is_verified),
    organic: Boolean(record.organic),
    unit: getField(record, 'unit') || 'kg',
    min_order_quantity: minOrderQuantity,
    same_day_available: Boolean(record.same_day_available),
    demand_score: getNumber(record.demand_score, 50),
    price_trend: getField(record, 'price_trend') || 'Stable',
    stock_status: getField(record, 'stock_status') || computeStockStatus(quantity, minOrderQuantity),
    latitude: record.latitude ?? null,
    longitude: record.longitude ?? null,
    delivery_radius_km: getNumber(record.delivery_radius_km, 30),
    tags: getArray(record.tags),
    delivery_eta: deliveryEta(record, farmer),
    quality_badge: Boolean(farmer.is_verified) ? 'Verified farmer' : 'Standard seller',
  };
}

export function serializeOrderUpdate(update: unknown) {
  const record = asRecord(update);
  const updateDate = record.update_date instanceof Date ? record.update_date : record.update_date ? new Date(record.update_date) : null;
  return {
    id: asIdString(record._id),
    status: getField(record, 'status'),
    update_date: record.update_date || null,
    update_date_display: formatDateTime(updateDate),
    location: getField(record, 'location'),
  };
}

export function serializeCustomerOrder(order: unknown, updates: unknown[] = []) {
  const record = asRecord(order);
  const crop = asRecord(record.crop);
  const farmer = asRecord(crop.farmer);
  const orderDate = record.order_date instanceof Date ? record.order_date : record.order_date ? new Date(record.order_date) : null;
  const status = getField(record, 'status') || 'Order Placed';
  return {
    id: asIdString(record._id),
    crop_name: getField(crop, 'name'),
    crop_id: asIdString(crop._id || record.crop),
    crop_image: getField(crop, 'image'),
    farmer_name: getField(farmer, 'full_name') || getField(farmer, 'username'),
    farmer_id: asIdString(farmer._id || crop.farmer),
    status,
    payment_status: getField(record, 'payment_status') || 'pending',
    payment_method: getField(record, 'payment_method'),
    payment_provider: getField(record, 'payment_provider'),
    payment_reference: getField(record, 'payment_reference'),
    payment_gateway_details: getObject(record, 'payment_gateway_details'),
    invoice_number: getField(record, 'invoice_number'),
    tracking_code: getField(record, 'tracking_code'),
    order_date: record.order_date || null,
    order_date_display: formatDateOnly(orderDate),
    quantity: getNumber(record.quantity),
    total_price: getNumber(record.total_price),
    estimated_delivery: getField(record, 'estimated_delivery'),
    current_location: getField(record, 'current_location'),
    buyer_note: getField(record, 'buyer_note'),
    delivery_address: getField(record, 'delivery_address'),
    fulfillment_window: getField(record, 'fulfillment_window'),
    is_bulk_order: Boolean(record.is_bulk_order),
    tracking: updates.map((update) => serializeOrderUpdate(update)),
    stage_index: stageIndex(updates, status),
  };
}

export function serializeFarmerDashboardOrder(order: unknown) {
  const record = asRecord(order);
  const crop = asRecord(record.crop);
  const customer = asRecord(record.customer);
  return {
    id: asIdString(record._id),
    crop_id: asIdString(crop._id || record.crop),
    crop_name: getField(crop, 'name'),
    customer_name: getField(customer, 'full_name') || getField(customer, 'username'),
    customer_email: getField(customer, 'email'),
    customer_district: getField(customer, 'district'),
    customer_state: getField(customer, 'state'),
    quantity: getNumber(record.quantity),
    total_price: getNumber(record.total_price),
    status: getField(record, 'status'),
    payment_status: getField(record, 'payment_status') || 'pending',
    payment_method: getField(record, 'payment_method'),
    payment_provider: getField(record, 'payment_provider'),
    payment_reference: getField(record, 'payment_reference'),
    payment_gateway_details: getObject(record, 'payment_gateway_details'),
    invoice_number: getField(record, 'invoice_number'),
    tracking_code: getField(record, 'tracking_code'),
    buyer_note: getField(record, 'buyer_note'),
    delivery_address: getField(record, 'delivery_address'),
    fulfillment_window: getField(record, 'fulfillment_window'),
    is_bulk_order: Boolean(record.is_bulk_order),
    order_date: record.order_date || null,
    estimated_delivery: getField(record, 'estimated_delivery'),
    current_location: getField(record, 'current_location'),
  };
}

export function serializeAdminOrder(order: unknown) {
  const record = asRecord(order);
  const crop = asRecord(record.crop);
  const customer = asRecord(record.customer);
  return {
    id: asIdString(record._id),
    customer_name: getField(customer, 'full_name') || getField(customer, 'username'),
    crop_name: getField(crop, 'name'),
    quantity: getNumber(record.quantity),
    total_price: getNumber(record.total_price),
    status: getField(record, 'status'),
    payment_status: getField(record, 'payment_status'),
    order_date: record.order_date || null,
    estimated_delivery: getField(record, 'estimated_delivery'),
    current_location: getField(record, 'current_location'),
  };
}

export function serializeReview(review: unknown) {
  const record = asRecord(review);
  const customer = asRecord(record.customer);
  return {
    id: asIdString(record._id),
    order: record.order ? String(record.order) : null,
    customer: asIdString(customer._id || record.customer),
    customer_name: getField(customer, 'full_name') || getField(customer, 'username'),
    farmer: asIdString(record.farmer),
    rating: getNumber(record.rating),
    comment: getField(record, 'comment'),
    created_at: record.created_at || null,
  };
}

export function serializeNotification(notification: unknown) {
  const record = asRecord(notification);
  const createdAt = record.created_at instanceof Date ? record.created_at : record.created_at ? new Date(record.created_at) : null;
  return {
    id: asIdString(record._id),
    title: getField(record, 'title'),
    body: getField(record, 'body'),
    category: getField(record, 'category') || 'info',
    meta: asRecord(record.meta),
    read: Boolean(record.read_at),
    created_at: record.created_at || null,
    created_at_display: formatDateTime(createdAt),
  };
}

export function serializeDiseaseReport(report: unknown) {
  const record = asRecord(report);
  const createdAt = record.created_at instanceof Date ? record.created_at : record.created_at ? new Date(record.created_at) : null;
  return {
    id: asIdString(record._id),
    crop_name: getField(record, 'crop_name'),
    symptoms: getField(record, 'symptoms'),
    image_name: getField(record, 'image_name'),
    image_url: mediaField(record, 'image_path', 'image_name'),
    risk_level: getField(record, 'risk_level'),
    predicted_disease: getField(record, 'predicted_disease'),
    recommendation: getField(record, 'recommendation'),
    confidence: getNumber(record.confidence),
    region: getField(record, 'region'),
    created_at: record.created_at || null,
    created_at_display: formatDateTime(createdAt),
  };
}

export function serializeIrrigationPlan(plan: unknown) {
  const record = asRecord(plan);
  const createdAt = record.created_at instanceof Date ? record.created_at : record.created_at ? new Date(record.created_at) : null;
  return {
    id: asIdString(record._id),
    crop_name: getField(record, 'crop_name'),
    soil_moisture: getNumber(record.soil_moisture),
    rainfall_mm: getNumber(record.rainfall_mm),
    temperature_c: getNumber(record.temperature_c),
    recommendation: getField(record, 'recommendation'),
    next_watering_window: getField(record, 'next_watering_window'),
    water_saving_percent: getNumber(record.water_saving_percent),
    automation_ready: Boolean(record.automation_ready),
    created_at: record.created_at || null,
    created_at_display: formatDateTime(createdAt),
  };
}

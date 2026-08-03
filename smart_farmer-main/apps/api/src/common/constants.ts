export const USER_ROLES = ['admin', 'farmer', 'customer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const CHALLENGE_PURPOSES = ['login', 'password_reset', 'admin', 'email_verification', 'signup_email_verification'] as const;
export type ChallengePurpose = (typeof CHALLENGE_PURPOSES)[number];

export const MARKETPLACE_CATEGORIES = [
  'Vegetables',
  'Fruits',
  'Grains',
  'Rice Varieties',
  'Pulses',
  'Spices',
  'Dairy Products',
  'Milk',
  'Eggs',
  'Meat',
  'Honey',
  'Organic Products',
  'Farming Products',
  'Herbs',
  'Seeds',
  'Others',
];

export const MARKETPLACE_STATES = [
  'Telangana',
  'Andhra Pradesh',
  'Karnataka',
  'Tamil Nadu',
  'Maharashtra',
  'Kerala',
  'Odisha',
  'Punjab',
  'Haryana',
];

export const ORDER_STAGES = [
  'Order Placed',
  'Order Confirmed',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
];

export const CHAT_CATEGORIES = ['order', 'chat', 'market', 'advisory', 'irrigation', 'disease', 'payment'] as const;

export const DEV_PAYMENT_METHODS = ['UPI', 'Card', 'Net Banking'] as const;
export type DevPaymentMethod = (typeof DEV_PAYMENT_METHODS)[number];

export const DEV_PAYMENT_PROVIDERS: Record<DevPaymentMethod, string[]> = {
  UPI: ['PhonePe', 'Google Pay', 'Paytm', 'BHIM', 'Razorpay'],
  Card: ['Visa Test', 'Mastercard Test', 'RuPay Test'],
  'Net Banking': ['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'Kotak'],
};

export const BLOCKED_EMAIL_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'invalid',
  'localhost',
  'test',
  'test.com',
  'test.local',
]);

export const ADVISORY_LIBRARY: Record<string, string[]> = {
  general: [
    'Refresh your stock every morning so buyers see live availability and accurate quantities.',
    'Use district, verification, and price filters to connect with serious buyers faster.',
    'Keep images clean and recent; fresh proof improves trust and conversion.',
    'Bundle small lots into bulk-friendly packs for institutions and restaurant buyers.',
  ],
  tomato: [
    'Scout lower leaves daily for blight and remove infected foliage quickly.',
    'Maintain balanced irrigation to reduce fruit cracking and blossom-end stress.',
    'Harvest by firmness grade and release stock in batches when demand is rising.',
  ],
  onion: [
    'Cure onions in shade with airflow before dispatch to improve shelf life.',
    'Avoid overwatering late in the cycle to reduce rot and storage loss.',
    'Use mesh packing and dry handling to maintain quality during transport.',
  ],
  rice: [
    'Track moisture before storage and keep sacks elevated above the floor.',
    'Promote variety name, milling quality, and harvest lot in each listing.',
    'Time bulk releases with demand spikes from district buyers and wholesalers.',
  ],
  chilli: [
    'Monitor for wilt and thrips after hot dry spells and isolate stressed plots.',
    'Dry produce evenly before storage to protect color and market quality.',
    'Use premium tags for export-grade, high-color, and low-moisture lots.',
  ],
};

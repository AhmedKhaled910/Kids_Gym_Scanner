export type ChildProfile = {
  id: string;
  parent_name: string;
  parent_phone: string | null;
  child_name: string;
  child_age: number;
  photo_url: string | null;
  entry_type: "Parent" | "Nanny/Driver";
  allergies: string | null;
  medical_info: string | null;
  is_sick: boolean;
  has_injury: boolean;
  injury_notes: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  whatsapp_consent: boolean;
  responsibility_consent_signed: boolean;
};

export type RuleCheck = {
  key: string;
  label: string;
  passed: boolean;
  message: string;
  severity: "info" | "warning" | "blocking";
};

export type ValidationResult = {
  child: ChildProfile;
  rules: RuleCheck[];
  canCheckIn: boolean; // false if any "blocking" rule failed
};

// ---------------- Entry / stay duration pricing ----------------
// NOTE: only "3 Hours" and the new package were requested to change here —
// double check "1 Hour" / "2 Hours" / "Full Day" match your real live prices
// before copying this file over, since this file doesn't know your latest edits.
export const DURATION_PRICES: Record<string, number> = {
  "1 Hour": 380,
  "2 Hours": 720,
  "3 Hours": 1050,
  "Full Day": 2000,
  "Package (12 Hours / Month)": 3800,
};

export const PAYMENT_METHODS = ["Cash", "Visa", "InstaPay"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, string> = {
  Cash: "💵",
  Visa: "💳",
  InstaPay: "📲",
};

// ---------------- Extra hours (add-on requested mid-visit) ----------------
// Flat-price buttons, not a formula — tap the one matching what the parent
// wants. Edit prices/labels here anytime.
export const EXTRA_HOUR_OPTIONS: { label: string; price: number }[] = [
  { label: "+1 Hour", price: 380 },
  { label: "+1-2 Hours", price: 340 },
  { label: "+2-3 Hours", price: 330 },
  { label: "+3-6 Hours", price: 950 },
];

// ---------------- Cafeteria ----------------
export const CAFETERIA_ITEMS = [
  "Drinks & Snacks - 25 LE",
  "Fruit & Chocolate Bars - 30 LE",
  "Premium Snacks - 35 LE",
  "Premium Snacks - 40 LE",
  "Jelly & Gummy - 60 LE",
  "Kinder Collection - 80 LE",
  "Kinder Collection - 100 LE",
  "Popcorn - 120 LE",
  "Meal - 300 LE",
  "Water - 15 LE",
] as const;

export type CafeteriaItemName = (typeof CAFETERIA_ITEMS)[number];

export const CAFETERIA_ICONS: Record<CafeteriaItemName, string> = {
  "Drinks & Snacks - 25 LE": "🍫🍿",
  "Fruit & Chocolate Bars - 30 LE": "🍓",
  "Premium Snacks - 35 LE": "🧀",
  "Premium Snacks - 40 LE": "🍫",
  "Jelly & Gummy - 60 LE": "🐻🍑",
  "Kinder Collection - 80 LE": "🍫",
  "Kinder Collection - 100 LE": "🎁",
  "Popcorn - 120 LE": "🍿",
  "Meal - 300 LE": "🍽️",
  "Water - 15 LE": "💧",
};

export const CAFETERIA_PRICES: Record<CafeteriaItemName, number> = {
  "Drinks & Snacks - 25 LE": 25,
  "Fruit & Chocolate Bars - 30 LE": 30,
  "Premium Snacks - 35 LE": 35,
  "Premium Snacks - 40 LE": 40,
  "Jelly & Gummy - 60 LE": 60,
  "Kinder Collection - 80 LE": 80,
  "Kinder Collection - 100 LE": 100,
  "Popcorn - 120 LE": 120,
  "Meal - 300 LE": 300,
  "Water - 15 LE": 15,
};


// item is a plain string (not the narrow union) because it can also hold an
// Extra Hours label, which lives in the same order/settle flow.
export type CafeteriaOrder = {
  id: string;
  check_in_id: string;
  item: string;
  price: number;
  status: "pending" | "paid";
  payment_method: PaymentMethod | null;
  created_at: string;
};

export type ActiveSession = {
  id: string;
  child_id: string;
  staff_id: string;
  check_in_time: string;
  duration_booked: string;
  amount_paid: number;
  payment_method: string;
  children_profiles: {
    child_name: string;
    child_age: number;
    parent_name: string;
  } | null;
  cafeteria_orders: CafeteriaOrder[];
};

export type LoyaltyRewardTier = "one_hour" | "two_hours";

export type LoyaltyTierStatus = {
  threshold: number;
  label: string;
  eligible: boolean;
  warning: boolean;
  redeemed: boolean;
};

export type LoyaltyStatus = {
  childId: string;
  childName: string;
  parentName: string;
  parentPhone: string | null;
  visits: number;
  oneHour: LoyaltyTierStatus;
  twoHours: LoyaltyTierStatus;
};

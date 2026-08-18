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
  "Crackers",
  "Candy - Small",
  "Candy - Large",
  "Juice / Soft Drink",
  "Chocolate - Small",
  "Chocolate - Large",
  "Water",
  "Socks",
] as const;

export type CafeteriaItemName = (typeof CAFETERIA_ITEMS)[number];

export const CAFETERIA_ICONS: Record<CafeteriaItemName, string> = {
  Crackers: "🍪",
  "Candy - Small": "🍬",
  "Candy - Large": "🍬",
  "Juice / Soft Drink": "🥤",
  "Chocolate - Small": "🍫",
  "Chocolate - Large": "🍫",
  Water: "💧",
  Socks: "🧦",
};

export const CAFETERIA_PRICES: Record<CafeteriaItemName, number> = {
  Crackers: 25,
  "Candy - Small": 30,
  "Candy - Large": 60,
  "Juice / Soft Drink": 25,
  "Chocolate - Small": 60,
  "Chocolate - Large": 100,
  Water: 15,
  Socks: 80,
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

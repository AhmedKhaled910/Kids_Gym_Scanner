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

export const DURATION_PRICES: Record<string, number> = {
  "1 Hour": 380,
  "2 Hours": 720,
  "3 Hours": 1080,
  "Full Day": 2000,
};

export const PAYMENT_METHODS = ["Cash", "Visa", "InstaPay"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, string> = {
  Cash: "💵",
  Visa: "💳",
  InstaPay: "📲",
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

// ---------------- Cafeteria ----------------

export const CAFETERIA_ITEMS = [
  "Crackers",
  "Candy",
  "Juice",
  "Soft Drink",
  "Chocolate",
  "Water",
  "Socks",
] as const;

export type CafeteriaItemName = (typeof CAFETERIA_ITEMS)[number];

export const CAFETERIA_ICONS: Record<CafeteriaItemName, string> = {
  Crackers: "🍪",
  Candy: "🍬",
  Juice: "🧃",
  "Soft Drink": "🥤",
  Chocolate: "🍫",
  Water: "💧",
  Socks: "🧦",
};

// Edit these to match real prices anytime.
export const CAFETERIA_PRICES: Record<CafeteriaItemName, number> = {
  Crackers: 30,
  Candy: 35,
  Juice: 30,
  "Soft Drink": 30,
  Chocolate: 50,
  Water: 20,
  Socks: 20,
};

export type CafeteriaOrder = {
  id: string;
  check_in_id: string;
  item: CafeteriaItemName;
  price: number;
  status: "pending" | "paid";
  payment_method: PaymentMethod | null;
  created_at: string;
};

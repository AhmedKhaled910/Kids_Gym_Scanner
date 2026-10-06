import type { LoyaltyRewardTier, LoyaltyStatus } from "@/lib/types";

// The business operates in Egypt by default. Override this when the venue is
// in another timezone so a visit near midnight is assigned to the right day.
const BUSINESS_TIME_ZONE = process.env.BUSINESS_TIME_ZONE || "Africa/Cairo";

function parts(date: Date) {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(values.map((p) => [p.type, p.value]));
}

export function loyaltyDayKey(date: Date | string) {
  const p = parts(typeof date === "string" ? new Date(date) : date);
  return `${p.year}-${p.month}-${p.day}`;
}

export function loyaltyMonthKey(date = new Date()) {
  const p = parts(date);
  return `${p.year}-${p.month}`;
}

export function loyaltyMonthStart(date = new Date()) {
  return `${loyaltyMonthKey(date)}-01`;
}

export function buildLoyaltyStatus(
  child: { id: string; child_name: string; parent_name: string; parent_phone: string | null },
  visitTimes: string[],
  redeemedTiers: Set<LoyaltyRewardTier>
): LoyaltyStatus {
  const visits = new Set(visitTimes.map(loyaltyDayKey)).size;
  const oneHourRedeemed = redeemedTiers.has("one_hour");
  const twoHoursRedeemed = redeemedTiers.has("two_hours");

  return {
    childId: child.id,
    childName: child.child_name,
    parentName: child.parent_name,
    parentPhone: child.parent_phone,
    visits,
    oneHour: {
      threshold: 5,
      label: "1 free hour",
      eligible: visits >= 5 && !oneHourRedeemed,
      warning: visits === 4 && !oneHourRedeemed,
      redeemed: oneHourRedeemed,
    },
    twoHours: {
      threshold: 10,
      label: "2 free hours",
      eligible: visits >= 10 && !twoHoursRedeemed,
      warning: visits === 9 && !twoHoursRedeemed,
      redeemed: twoHoursRedeemed,
    },
  };
}

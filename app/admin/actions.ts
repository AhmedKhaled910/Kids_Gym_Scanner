"use server";

import { getSupabaseServerClient } from "@/lib/supabase";
import { getStaffSession } from "@/lib/auth";
import { syncRegistrations, type SyncResult } from "@/lib/googleSheetsRegistrations";
import { sendChildQrToWhatsApp } from "@/lib/whatsapp";
import { buildLoyaltyStatus, loyaltyMonthKey, loyaltyMonthStart } from "@/lib/loyalty";
import type { LoyaltyRewardTier, LoyaltyStatus } from "@/lib/types";
import { revalidatePath } from "next/cache";

export async function runRegistrationsSync(): Promise<SyncResult> {
  const result = await syncRegistrations();
  revalidatePath("/admin");
  return result;
}

export async function listChildrenForQr() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("children_profiles")
    .select("id, child_name, parent_name, parent_phone")
    .order("child_name", { ascending: true });
  if (error) return [];
  return data ?? [];
}

/** Sends the child's QR code to their parent's phone via WhatsApp. */
export async function sendQrToParent(
  childId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return { ok: false, error: "NEXT_PUBLIC_APP_URL is not set — WhatsApp needs a public image link." };
  }
  const supabase = getSupabaseServerClient();
  const { data: child, error } = await supabase
    .from("children_profiles")
    .select("id, child_name, parent_name, parent_phone")
    .eq("id", childId)
    .single();
  if (error || !child) return { ok: false, error: "Child not found." };
  if (!child.parent_phone) return { ok: false, error: "No parent phone number on file." };
  return sendChildQrToWhatsApp({
    phone: child.parent_phone,
    parentName: child.parent_name,
    childName: child.child_name,
    qrImageUrl: `${appUrl}/api/public/qrcodes/${child.id}`,
  });
}

/** Returns this month's distinct-visit progress and both reward tiers. */
export async function getLoyaltyStatuses(): Promise<LoyaltyStatus[]> {
  const staff = await getStaffSession();
  if (!staff) return [];

  const supabase = getSupabaseServerClient();
  const monthStart = loyaltyMonthStart();
  const [{ data: children }, { data: visits }, { data: rewards }] = await Promise.all([
    supabase
      .from("children_profiles")
      .select("id, child_name, parent_name, parent_phone")
      .order("child_name", { ascending: true }),
    supabase
      .from("check_ins")
      .select("child_id, check_in_time")
      .gte("check_in_time", new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from("loyalty_rewards")
      .select("child_id, tier, redeemed_at")
      .eq("month_start", monthStart),
  ]);

  if (!children) return [];
  const month = monthStart.slice(0, 7);
  const visitsByChild = new Map<string, string[]>();
  for (const visit of visits ?? []) {
    if (visit.check_in_time && loyaltyMonthKey(new Date(visit.check_in_time)) === month) {
      const existing = visitsByChild.get(visit.child_id) ?? [];
      existing.push(visit.check_in_time);
      visitsByChild.set(visit.child_id, existing);
    }
  }

  const redeemedByChild = new Map<string, Set<LoyaltyRewardTier>>();
  for (const reward of rewards ?? []) {
    if (!reward.redeemed_at) continue;
    const tier = reward.tier as LoyaltyRewardTier;
    if (tier !== "one_hour" && tier !== "two_hours") continue;
    const tiers = redeemedByChild.get(reward.child_id) ?? new Set<LoyaltyRewardTier>();
    tiers.add(tier);
    redeemedByChild.set(reward.child_id, tiers);
  }

  return children.map((child) =>
    buildLoyaltyStatus(child, visitsByChild.get(child.id) ?? [], redeemedByChild.get(child.id) ?? new Set())
  );
}

/** Marks one reward tier as used for the current month. */
export async function redeemLoyaltyReward(
  childId: string,
  tier: LoyaltyRewardTier
): Promise<{ ok: true } | { ok: false; error: string }> {
  const staff = await getStaffSession();
  if (!staff) return { ok: false, error: "Not authenticated." };
  if (tier !== "one_hour" && tier !== "two_hours") {
    return { ok: false, error: "Invalid loyalty reward tier." };
  }

  const supabase = getSupabaseServerClient();
  const monthStart = loyaltyMonthStart();
  const { data: visits } = await supabase
    .from("check_ins")
    .select("check_in_time")
    .eq("child_id", childId)
    .gte("check_in_time", new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString());

  const monthVisits = (visits ?? [])
    .filter((visit) => visit.check_in_time && loyaltyMonthKey(new Date(visit.check_in_time)) === monthStart.slice(0, 7))
    .map((visit) => visit.check_in_time);
  const threshold = tier === "one_hour" ? 5 : 10;
  const status = buildLoyaltyStatus(
    { id: childId, child_name: "", parent_name: "", parent_phone: null },
    monthVisits,
    new Set()
  );
  if (status.visits < threshold) {
    return { ok: false, error: `This child has not reached ${threshold} visits this month.` };
  }

  const { error } = await supabase.from("loyalty_rewards").upsert(
    {
      child_id: childId,
      month_start: monthStart,
      tier,
      redeemed_at: new Date().toISOString(),
      redeemed_by: staff,
    },
    { onConflict: "child_id,month_start,tier" }
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

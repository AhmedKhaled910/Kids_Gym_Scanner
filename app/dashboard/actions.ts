"use server";

import { getSupabaseServerClient } from "@/lib/supabase";
import { getStaffSession } from "@/lib/auth";
import { appendDailyLogRow } from "@/lib/googleSheets";
import { revalidatePath } from "next/cache";
import type { ChildProfile, RuleCheck, ValidationResult, CafeteriaItemName, PaymentMethod } from "@/lib/types";
import { DURATION_PRICES, CAFETERIA_PRICES } from "@/lib/types";

/**
 * Fetches a child's profile by QR/UUID and runs every business rule
 * from the process map. Returns pass/fail state per rule so the UI
 * can render green checks / red crosses, plus an overall canCheckIn flag.
 */
export async function fetchAndValidateChild(
  rawScannedId: string
): Promise<{ ok: true; data: ValidationResult } | { ok: false; error: string }> {
  const scannedId = rawScannedId.trim();
  if (!scannedId) return { ok: false, error: "Empty ID scanned." };

  const supabase = getSupabaseServerClient();
  const { data: child, error } = await supabase
    .from("children_profiles")
    .select("*")
    .eq("id", scannedId)
    .single<ChildProfile>();

  if (error || !child) {
    return { ok: false, error: "No profile found for this QR code / ID." };
  }

  const rules: RuleCheck[] = [];

  // 1. Age verification (informational — never blocks entry)
  if (child.child_age < 5) {
    rules.push({
      key: "age",
      label: "Age Verification",
      passed: true,
      message:
        "⚠️ Child is under 5. MUST stay with a caregiver/guardian at all times.",
      severity: "warning",
    });
  } else {
    rules.push({
      key: "age",
      label: "Age Verification",
      passed: true,
      message: "✅ Child may enter independently.",
      severity: "info",
    });
  }

  // 2. Nanny/Driver drop-off requires WhatsApp consent
  if (child.entry_type === "Nanny/Driver") {
    const passed = child.whatsapp_consent === true;
    rules.push({
      key: "nanny_consent",
      label: "Nanny/Driver WhatsApp Consent",
      passed,
      message: passed
        ? "✅ Parent WhatsApp consent on file for Nanny/Driver drop-off."
        : "❌ Entry denied. Parent WhatsApp consent is missing.",
      severity: "blocking",
    });
  }

  // 3. Illness / injury requires signed responsibility consent
  if (child.is_sick || child.has_injury) {
    const passed = child.responsibility_consent_signed === true;
    const condition = child.is_sick && child.has_injury
      ? "illness and injury"
      : child.is_sick
      ? "illness"
      : "injury";
    rules.push({
      key: "illness_injury",
      label: "Illness / Injury Consent",
      passed,
      message: passed
        ? `✅ Responsibility consent signed for reported ${condition}.`
        : `❌ Entry denied. Responsibility consent form is not signed for reported ${condition}.`,
      severity: "blocking",
    });
  }

  const canCheckIn = rules.every((r) => r.severity !== "blocking" || r.passed);

  return { ok: true, data: { child, rules, canCheckIn } };
}

/**
 * Confirms check-in: inserts a check_ins row with the chosen duration,
 * calculated price, and payment method. Also logs to Google Sheets.
 */
export async function confirmCheckIn(input: {
  childId: string;
  duration: string;
  paymentMethod: PaymentMethod;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const staffId = await getStaffSession();
  if (!staffId) return { ok: false, error: "Not authenticated." };

  const price = DURATION_PRICES[input.duration];
  if (price === undefined) return { ok: false, error: "Invalid duration." };

  const supabase = getSupabaseServerClient();

  // Prevent double check-in: block if this child already has an open session
  const { data: existing } = await supabase
    .from("check_ins")
    .select("id")
    .eq("child_id", input.childId)
    .is("check_out_time", null)
    .limit(1);

  if (existing && existing.length > 0) {
    return { ok: false, error: "This child is already checked in." };
  }

  const { error } = await supabase.from("check_ins").insert({
    child_id: input.childId,
    staff_id: staffId,
    duration_booked: input.duration,
    amount_paid: price,
    payment_method: input.paymentMethod,
  });

  if (error) return { ok: false, error: error.message };

  // Best-effort daily log — never blocks check-in if Sheets fails.
  const { data: child } = await supabase
    .from("children_profiles")
    .select("child_name, parent_name")
    .eq("id", input.childId)
    .single();

  await appendDailyLogRow({
    event: "Check-In",
    parentName: child?.parent_name ?? "",
    childName: child?.child_name ?? "",
    details: `${input.duration} · ${input.paymentMethod}`,
    amount: price,
    staff: staffId,
  });

  revalidatePath("/active-sessions");
  return { ok: true };
}

/**
 * Lists all children currently checked in (no check_out_time yet),
 * including their cafeteria orders for the card UI.
 */
export async function getActiveSessions() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("check_ins")
    .select(
      "id, child_id, staff_id, check_in_time, duration_booked, amount_paid, payment_method, children_profiles ( child_name, child_age, parent_name ), cafeteria_orders ( id, check_in_id, item, price, status, created_at )"
    )
    .is("check_out_time", null)
    .order("check_in_time", { ascending: true });

  if (error) return [];
  // Supabase types the joined relation as an array by default; normalize it.
  return (data ?? []).map((row: any) => ({
    ...row,
    children_profiles: Array.isArray(row.children_profiles)
      ? row.children_profiles[0] ?? null
      : row.children_profiles,
    cafeteria_orders: row.cafeteria_orders ?? [],
  }));
}

/** Checks a child out: stamps check_out_time. Logs to Google Sheets. */
export async function confirmCheckOut(
  checkInId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseServerClient();

  const { data: session } = await supabase
    .from("check_ins")
    .select("check_in_time, children_profiles ( child_name, parent_name )")
    .eq("id", checkInId)
    .single();

  const { error } = await supabase
    .from("check_ins")
    .update({ check_out_time: new Date().toISOString() })
    .eq("id", checkInId);

  if (error) return { ok: false, error: error.message };

  const staffId = (await getStaffSession()) ?? "";
  const profile: any = Array.isArray(session?.children_profiles)
    ? session?.children_profiles[0]
    : session?.children_profiles;
  const minutes = session
    ? Math.round((Date.now() - new Date(session.check_in_time).getTime()) / 60000)
    : null;

  await appendDailyLogRow({
    event: "Check-Out",
    parentName: profile?.parent_name ?? "",
    childName: profile?.child_name ?? "",
    details: minutes !== null ? `Stayed ~${minutes} min` : "",
    amount: "",
    staff: staffId,
  });

  revalidatePath("/active-sessions");
  return { ok: true };
}

/**
 * Adds one cafeteria item as "pending" for a checked-in child. Logs to
 * Google Sheets immediately (not waiting for payment) so the daily sheet
 * shows the order was made.
 */
export async function addCafeteriaItem(input: {
  checkInId: string;
  item: CafeteriaItemName;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const price = CAFETERIA_PRICES[input.item];
  if (price === undefined) return { ok: false, error: "Invalid item." };

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("cafeteria_orders").insert({
    check_in_id: input.checkInId,
    item: input.item,
    price,
    status: "pending",
  });

  if (error) return { ok: false, error: error.message };

  const { data: session } = await supabase
    .from("check_ins")
    .select("children_profiles ( child_name, parent_name )")
    .eq("id", input.checkInId)
    .single();
  const profile: any = Array.isArray(session?.children_profiles)
    ? session?.children_profiles[0]
    : session?.children_profiles;

  const staffId = (await getStaffSession()) ?? "";
  await appendDailyLogRow({
    event: "Cafeteria Order",
    parentName: profile?.parent_name ?? "",
    childName: profile?.child_name ?? "",
    details: input.item,
    amount: price,
    staff: staffId,
  });

  revalidatePath("/active-sessions");
  return { ok: true };
}

/**
 * Marks all pending cafeteria orders for a check-in as paid, and logs the
 * settlement total to Google Sheets.
 */
export async function settleCafeteriaPayment(
  checkInId: string,
  paymentMethod: PaymentMethod
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseServerClient();

  const { data: pending, error: fetchError } = await supabase
    .from("cafeteria_orders")
    .select("id, item, price")
    .eq("check_in_id", checkInId)
    .eq("status", "pending");

  if (fetchError) return { ok: false, error: fetchError.message };
  if (!pending || pending.length === 0) return { ok: true };

  const { error } = await supabase
    .from("cafeteria_orders")
    .update({ status: "paid", payment_method: paymentMethod })
    .eq("check_in_id", checkInId)
    .eq("status", "pending");

  if (error) return { ok: false, error: error.message };

  const total = pending.reduce((sum, p: any) => sum + Number(p.price), 0);
  const items = pending.map((p: any) => p.item).join(", ");

  const { data: session } = await supabase
    .from("check_ins")
    .select("children_profiles ( child_name, parent_name )")
    .eq("id", checkInId)
    .single();
  const profile: any = Array.isArray(session?.children_profiles)
    ? session?.children_profiles[0]
    : session?.children_profiles;

  const staffId = (await getStaffSession()) ?? "";
  await appendDailyLogRow({
    event: "Cafeteria Payment Settled",
    parentName: profile?.parent_name ?? "",
    childName: profile?.child_name ?? "",
    details: `${items} · ${paymentMethod}`,
    amount: total,
    staff: staffId,
  });

  revalidatePath("/active-sessions");
  return { ok: true };
}

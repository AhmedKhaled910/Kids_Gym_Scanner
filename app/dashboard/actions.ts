"use server";

import { getSupabaseServerClient } from "@/lib/supabase";
import { getStaffSession } from "@/lib/auth";
import { sheetCreateCheckInRow, sheetSetCheckOutTime, sheetRecordAddon } from "@/lib/googleSheets";
import { revalidatePath } from "next/cache";
import type { ChildProfile, RuleCheck, ValidationResult, PaymentMethod } from "@/lib/types";
import { DURATION_PRICES } from "@/lib/types";

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

  if (child.child_age < 5) {
    rules.push({
      key: "age",
      label: "Age Verification",
      passed: true,
      message: "⚠️ Child is under 5. MUST stay with a caregiver/guardian at all times.",
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

  if (child.is_sick || child.has_injury) {
    const passed = child.responsibility_consent_signed === true;
    const condition =
      child.is_sick && child.has_injury ? "illness and injury" : child.is_sick ? "illness" : "injury";
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
 * Confirms check-in. The Supabase insert is the only step that can make
 * this fail — everything after it (fetching child info for the log,
 * writing to Google Sheets) is wrapped so it NEVER throws back to the
 * caller. If the insert succeeded, the check-in is real and this always
 * returns { ok: true }, even if the Sheets logging silently failed.
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

  const { data: existing } = await supabase
    .from("check_ins")
    .select("id")
    .eq("child_id", input.childId)
    .is("check_out_time", null)
    .limit(1);

  if (existing && existing.length > 0) {
    return { ok: false, error: "This child is already checked in." };
  }

  const { data: inserted, error } = await supabase
    .from("check_ins")
    .insert({
      child_id: input.childId,
      staff_id: staffId,
      duration_booked: input.duration,
      amount_paid: price,
      payment_method: input.paymentMethod,
    })
    .select("id")
    .single();

  if (error || !inserted) return { ok: false, error: error?.message ?? "Insert failed." };

  // From here on, the check-in is already saved — nothing below is allowed
  // to make this function throw, or the UI would wrongly show an error /
  // hang for a check-in that actually succeeded.
  try {
    const { data: child } = await supabase
      .from("children_profiles")
      .select("child_name, parent_name")
      .eq("id", input.childId)
      .single();

    await sheetCreateCheckInRow({
      checkInId: inserted.id,
      parentName: child?.parent_name ?? "",
      childName: child?.child_name ?? "",
      duration: input.duration,
      entryAmount: price,
      entryPayment: input.paymentMethod,
      staff: staffId,
    });
  } catch (err) {
    console.error("Post-check-in logging failed (check-in itself still succeeded):", err);
  }

  try {
    revalidatePath("/active-sessions");
  } catch (err) {
    console.error("revalidatePath failed:", err);
  }

  return { ok: true };
}

export async function getActiveSessions() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("check_ins")
    .select(
      "id, child_id, staff_id, check_in_time, duration_booked, amount_paid, payment_method, children_profiles ( child_name, child_age, parent_name ), cafeteria_orders ( id, check_in_id, item, price, status, payment_method, created_at )"
    )
    .is("check_out_time", null)
    .order("check_in_time", { ascending: true });

  if (error) return [];
  return (data ?? []).map((row: any) => ({
    ...row,
    children_profiles: Array.isArray(row.children_profiles)
      ? row.children_profiles[0] ?? null
      : row.children_profiles,
    cafeteria_orders: row.cafeteria_orders ?? [],
  }));
}

export async function confirmCheckOut(
  checkInId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase
    .from("check_ins")
    .update({ check_out_time: new Date().toISOString() })
    .eq("id", checkInId);

  if (error) return { ok: false, error: error.message };

  try {
    await sheetSetCheckOutTime(checkInId);
  } catch (err) {
    console.error("Sheets check-out log failed (check-out itself still succeeded):", err);
  }

  try {
    revalidatePath("/active-sessions");
  } catch (err) {
    console.error("revalidatePath failed:", err);
  }

  return { ok: true };
}

export async function addSessionItem(input: {
  checkInId: string;
  item: string;
  price: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("cafeteria_orders").insert({
    check_in_id: input.checkInId,
    item: input.item,
    price: input.price,
    status: "pending",
  });

  if (error) return { ok: false, error: error.message };

  try {
    await sheetRecordAddon({ checkInId: input.checkInId, item: input.item, price: input.price });
  } catch (err) {
    console.error("Sheets add-on log failed (order itself still succeeded):", err);
  }

  try {
    revalidatePath("/active-sessions");
  } catch (err) {
    console.error("revalidatePath failed:", err);
  }

  return { ok: true };
}

export async function settleCafeteriaPayment(
  checkInId: string,
  paymentMethod: PaymentMethod
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase
    .from("cafeteria_orders")
    .update({ status: "paid", payment_method: paymentMethod })
    .eq("check_in_id", checkInId)
    .eq("status", "pending");

  if (error) return { ok: false, error: error.message };

  try {
    revalidatePath("/active-sessions");
  } catch (err) {
    console.error("revalidatePath failed:", err);
  }

  return { ok: true };
}

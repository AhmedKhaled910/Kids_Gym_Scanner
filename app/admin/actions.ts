"use server";

import { getSupabaseServerClient } from "@/lib/supabase";
import { syncRegistrations, type SyncResult } from "@/lib/googleSheetsRegistrations";
import { sendChildQrToWhatsApp } from "@/lib/whatsapp";
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

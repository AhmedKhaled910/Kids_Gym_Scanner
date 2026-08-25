"use server";

import { getSupabaseServerClient } from "@/lib/supabase";
import { syncRegistrations, type SyncResult } from "@/lib/googleSheetsRegistrations";
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
    .select("id, child_name, parent_name")
    .order("child_name", { ascending: true });

  if (error) return [];
  return data ?? [];
}

"use server";

import { createStaffSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function loginWithPin(formData: FormData) {
  const pin = String(formData.get("pin") ?? "").trim();
  const staffName = String(formData.get("staffName") ?? "").trim() || "Staff";
  const validPin = process.env.STAFF_PIN;

  if (!validPin) {
    throw new Error("STAFF_PIN is not configured on the server.");
  }

  if (pin !== validPin) {
    redirect("/login?error=1");
  }

  await createStaffSession(staffName);
  redirect("/dashboard");
}

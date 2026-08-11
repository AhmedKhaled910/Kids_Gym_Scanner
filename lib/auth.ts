import { cookies } from "next/headers";

const COOKIE_NAME = "staff_session";

// Very lightweight "staff is logged in" cookie. Good enough for an
// internal single-PIN tool. For multiple staff accounts with named
// audit trails, swap this for Supabase Auth later.
export async function createStaffSession(staffLabel: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, staffLabel, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days — stays signed in across app/browser restarts
  });
}

export async function getStaffSession(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

export async function destroyStaffSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

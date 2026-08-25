import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET() {
  const staff = await getStaffSession();
  if (!staff) return new NextResponse("Unauthorized", { status: 401 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("children_profiles")
    .select("id, child_name, parent_name")
    .order("child_name", { ascending: true });

  if (error) return NextResponse.json([]);
  return NextResponse.json(data ?? []);
}

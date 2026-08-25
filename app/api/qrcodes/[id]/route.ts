import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase";
import { generateQrPng, qrFileName } from "@/lib/qrcode";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffSession();
  if (!staff) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseServerClient();
  const { data: child, error } = await supabase
    .from("children_profiles")
    .select("id, child_name")
    .eq("id", id)
    .single();

  if (error || !child) return new NextResponse("Not found", { status: 404 });

  const png = await generateQrPng(child.id);
  return new NextResponse(png, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${qrFileName(child.child_name, child.id)}"`,
    },
  });
}

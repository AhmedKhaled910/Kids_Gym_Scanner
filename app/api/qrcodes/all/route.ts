import { NextResponse } from "next/server";
import JSZip from "jszip";
import { getStaffSession } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase";
import { generateQrPng, qrFileName } from "@/lib/qrcode";

export async function GET() {
  const staff = await getStaffSession();
  if (!staff) return new NextResponse("Unauthorized", { status: 401 });

  const supabase = getSupabaseServerClient();
  const { data: children, error } = await supabase
    .from("children_profiles")
    .select("id, child_name")
    .order("child_name", { ascending: true });

  if (error) return new NextResponse("Failed to load children", { status: 500 });

  const zip = new JSZip();
  for (const child of children ?? []) {
    const png = await generateQrPng(child.id);
    zip.file(qrFileName(child.child_name, child.id), png);
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="all_qr_codes.zip"`,
    },
  });
}

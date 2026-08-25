import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { generateQrPng } from "@/lib/qrcode";

// Intentionally NOT behind staff auth — WhatsApp's servers fetch this URL
// directly to attach the QR image to the message, and can't send our staff
// login cookie. Safe because the id is an unguessable UUID and this route
// only ever returns a QR image (no personal data).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServerClient();
  const { data: child, error } = await supabase
    .from("children_profiles")
    .select("id")
    .eq("id", id)
    .single();

  if (error || !child) return new NextResponse("Not found", { status: 404 });

  const png = await generateQrPng(child.id);
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

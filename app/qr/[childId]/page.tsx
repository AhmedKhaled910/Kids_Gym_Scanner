// app/qr/[childId]/page.tsx
import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase";

export default async function QRPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;

  const supabase = getSupabaseServerClient();
  const { data: child } = await supabase
    .from("children_profiles")
    .select("child_name, parent_name")
    .eq("id", childId)
    .single();

  if (!child) notFound();

  const qrDataUrl = await QRCode.toDataURL(childId, { width: 400, margin: 2 });

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
        <h1 className="mb-2 text-2xl font-bold">
          {child.child_name}&apos;s QR Code
        </h1>
        <p className="mb-6 text-gray-600">Show this at drop-off 🧒</p>

        <img src={qrDataUrl} alt="QR Code" className="mx-auto rounded-lg" />

        <p className="mt-6 text-xs text-gray-400">
          Screenshot or bookmark this page for easy access
        </p>
      </div>
    </main>
  );
}
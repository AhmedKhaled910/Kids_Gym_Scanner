"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runRegistrationsSync } from "../actions";
import type { SyncResult } from "@/lib/googleSheetsRegistrations";

type Child = { id: string; child_name: string; parent_name: string; parent_phone: string | null };

// No link in the message on purpose — a bare link in an unsolicited WhatsApp
// message reads as spam/phishing to parents. Staff attaches the already
// downloaded QR image manually inside WhatsApp before hitting send.
function buildWhatsAppLink(phone: string, childName: string, parentName: string) {
  const digits = phone.replace(/[^\d]/g, "");
  const message = `Hi ${parentName || "there"}, here is ${
    childName || "your child"
  }'s entry QR code. Please show this at check-in each visit.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export default function AdminPanel({ initialChildren }: { initialChildren: Child[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncResult | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const childList = initialChildren;

  function handleSync() {
    setResult(null);
    startTransition(async () => {
      const res = await runRegistrationsSync();
      setResult(res);
      router.refresh();
    });
  }

  function markSent(childId: string) {
    setSentIds((prev) => new Set(prev).add(childId));
  }

  return (
    <div className="space-y-6">
      {/* Sync section */}
      <div className="bg-white rounded-2xl shadow-md p-4 space-y-3">
        <h2 className="font-bold text-gray-800">📋 Sync Registrations</h2>
        <p className="text-sm text-gray-500">
          Pulls parent/child records from the "Registrations" sheet tab into the
          system, and updates any already-imported records if they changed in
          the sheet.
        </p>
        <button
          disabled={isPending}
          onClick={handleSync}
          className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3"
        >
          {isPending ? "Working…" : "🔄 Sync Now"}
        </button>

        {result && (
          <div
            className={`rounded-xl px-3 py-2 text-sm ${
              result.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
            }`}
          >
            ✅ {result.created} new, {result.updated} updated, {result.healed} auto-fixed, {result.skipped} skipped.
            {result.errors.length > 0 && (
              <ul className="mt-1 list-disc list-inside text-red-700">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* QR codes + WhatsApp section */}
      <div className="bg-white rounded-2xl shadow-md p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-800">🔳 QR Codes</h2>
          <a
            href="/api/qrcodes/all"
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-3 py-2"
          >
            ⬇️ ZIP All
          </a>
        </div>
        <p className="text-sm text-gray-500">
          {childList.length} registered {childList.length === 1 ? "child" : "children"}.
        </p>
        <p className="text-xs text-gray-400">
          Tip: tap Download first to save the QR image, then Open in WhatsApp and attach it
          manually before sending.
        </p>

        <div className="divide-y divide-gray-100 max-h-[32rem] overflow-y-auto">
          {childList.map((c) => {
            const waLink = c.parent_phone
              ? buildWhatsAppLink(c.parent_phone, c.child_name, c.parent_name)
              : null;
            const alreadySent = sentIds.has(c.id);

            return (
              <div key={c.id} className="py-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.child_name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      Parent: {c.parent_name} {c.parent_phone ? `· ${c.parent_phone}` : "· no phone on file"}
                    </p>
                  </div>
                  <a
                    href={`/api/qrcodes/${c.id}`}
                    className="rounded-lg bg-gray-100 hover:bg-indigo-100 text-gray-700 text-xs font-medium px-3 py-2 shrink-0"
                  >
                    ⬇️ Download
                  </a>
                </div>
                {waLink ? (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => markSent(c.id)}
                    className={`block w-full text-center rounded-lg text-xs font-medium py-2 ${
                      alreadySent
                        ? "bg-gray-50 text-gray-500"
                        : "bg-green-50 hover:bg-green-100 text-green-700"
                    }`}
                  >
                    {alreadySent ? "🔁 Send QR Code Again" : "📲 Open in WhatsApp"}
                  </a>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-2">No phone on file</p>
                )}
              </div>
            );
          })}
          {childList.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No children registered yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

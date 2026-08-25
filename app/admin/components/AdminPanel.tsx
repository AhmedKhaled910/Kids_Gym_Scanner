"use client";

import { useState, useTransition } from "react";
import { runRegistrationsSync } from "../actions";
import type { SyncResult } from "@/lib/googleSheetsRegistrations";

type Child = { id: string; child_name: string; parent_name: string };

export default function AdminPanel({ initialChildren }: { initialChildren: Child[] }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncResult | null>(null);
  const [children, setChildren] = useState(initialChildren);

  function handleSync() {
    setResult(null);
    startTransition(async () => {
      const res = await runRegistrationsSync();
      setResult(res);
      // Refresh the list so newly-imported families show up immediately.
      const refreshed = await fetch("/api/qrcodes/list").then((r) => r.json()).catch(() => null);
      if (refreshed) setChildren(refreshed);
    });
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
          {isPending ? "Syncing…" : "🔄 Sync Now"}
        </button>

        {result && (
          <div
            className={`rounded-xl px-3 py-2 text-sm ${
              result.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
            }`}
          >
            ✅ {result.created} new, {result.updated} updated, {result.skipped} skipped.
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

      {/* QR codes section */}
      <div className="bg-white rounded-2xl shadow-md p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-800">🔳 QR Codes</h2>
          <a
            href="/api/qrcodes/all"
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-3 py-2"
          >
            ⬇️ Download All (ZIP)
          </a>
        </div>
        <p className="text-sm text-gray-500">
          {children.length} registered {children.length === 1 ? "child" : "children"}. Send each
          QR image to the parent via WhatsApp/SMS.
        </p>

        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {children.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium text-gray-800">{c.child_name}</p>
                <p className="text-xs text-gray-400">Parent: {c.parent_name}</p>
              </div>
              <a
                href={`/api/qrcodes/${c.id}`}
                className="rounded-lg bg-gray-100 hover:bg-indigo-100 text-gray-700 text-xs font-medium px-3 py-2"
              >
                Download QR
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

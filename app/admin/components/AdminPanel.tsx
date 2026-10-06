"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { redeemLoyaltyReward, runRegistrationsSync } from "../actions";
import type { SyncResult } from "@/lib/googleSheetsRegistrations";
import type { LoyaltyStatus } from "@/lib/types";

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

export default function AdminPanel({
  initialChildren,
  initialLoyaltyStatuses,
}: {
  initialChildren: Child[];
  initialLoyaltyStatuses: LoyaltyStatus[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncResult | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [loyaltyStatuses, setLoyaltyStatuses] = useState(initialLoyaltyStatuses);
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

  function handleRedeem(childId: string, tier: "one_hour" | "two_hours") {
    startTransition(async () => {
      const res = await redeemLoyaltyReward(childId, tier);
      if (res.ok) {
        setLoyaltyStatuses((current) =>
          current.map((status) =>
            status.childId === childId
              ? {
                  ...status,
                  [tier === "one_hour" ? "oneHour" : "twoHours"]: {
                    ...status[tier === "one_hour" ? "oneHour" : "twoHours"],
                    redeemed: true,
                    eligible: false,
                    warning: false,
                  },
                }
              : status
          )
        );
      }
    });
  }

  function buildLoyaltyLink(status: LoyaltyStatus) {
    if (!status.parentPhone) return null;
    const message = status.visits >= 10
      ? `Hi ${status.parentName || "there"}, ${status.childName} has reached 10 visits this month and earned 2 free hours. Please ask the staff about it on your next visit.`
      : status.visits >= 5
      ? `Hi ${status.parentName || "there"}, ${status.childName} has reached 5 visits this month and earned 1 free hour. Please ask the staff about it on your next visit.`
      : `Hi ${status.parentName || "there"}, ${status.childName} has completed 4 visits this month. One more visit unlocks 1 free hour.`;
    return `https://wa.me/${status.parentPhone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(message)}`;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-md p-4 space-y-3">
        <div>
          <h2 className="font-bold text-gray-800">🎁 Monthly Loyalty Rewards</h2>
          <p className="text-sm text-gray-500">
            One visit per child is counted per calendar day. At 5 visits the child earns 1 free hour; at 10 visits, 2 free hours. Both rewards reset automatically each month.
          </p>
        </div>
        {loyaltyStatuses.filter((status) => status.visits >= 4 || status.oneHour.redeemed || status.twoHours.redeemed).length === 0 ? (
          <p className="text-sm text-gray-400">No children are close to a loyalty offer this month.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {loyaltyStatuses
              .filter((status) => status.visits >= 4 || status.oneHour.redeemed || status.twoHours.redeemed)
              .map((status) => {
                const messageLink = buildLoyaltyLink(status);
                return (
                  <div key={status.childId} className="py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-800">{status.childName}</p>
                        <p className="text-xs text-gray-500">Parent: {status.parentName}</p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                        {status.visits} visit{status.visits === 1 ? "" : "s"} this month
                      </span>
                    </div>
                    {!status.oneHour.redeemed && status.oneHour.warning && (
                      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        ⚠️ One more visit to earn 1 free hour.
                      </p>
                    )}
                    {!status.twoHours.redeemed && status.twoHours.warning && (
                      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        ⚠️ One more visit to earn 2 free hours.
                      </p>
                    )}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                        <span>5 visits → 1 free hour</span>
                        {status.oneHour.redeemed ? (
                          <span className="text-xs text-gray-500">Used this month</span>
                        ) : status.oneHour.eligible ? (
                          <button
                            disabled={isPending}
                            onClick={() => handleRedeem(status.childId, "one_hour")}
                            className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                          >
                            Mark Used
                          </button>
                        ) : (
                          <span className="text-xs text-gray-500">{Math.max(0, 5 - status.visits)} left</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                        <span>10 visits → 2 free hours</span>
                        {status.twoHours.redeemed ? (
                          <span className="text-xs text-gray-500">Used this month</span>
                        ) : status.twoHours.eligible ? (
                          <button
                            disabled={isPending}
                            onClick={() => handleRedeem(status.childId, "two_hours")}
                            className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                          >
                            Mark Used
                          </button>
                        ) : (
                          <span className="text-xs text-gray-500">{Math.max(0, 10 - status.visits)} left</span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {messageLink && (
                        <a
                          href={messageLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg bg-green-50 py-2 text-center text-xs font-medium text-green-700"
                        >
                          📲 Notify Parent
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

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

"use client";

import { useState, useTransition } from "react";
import { confirmCheckOut, addSessionItem, settleCafeteriaPayment } from "../../dashboard/actions";
import type { ActiveSession, PaymentMethod } from "@/lib/types";
import {
  CAFETERIA_ITEMS,
  CAFETERIA_ICONS,
  CAFETERIA_PRICES,
  EXTRA_HOUR_OPTIONS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_ICONS,
} from "@/lib/types";

function formatElapsed(checkInTime: string) {
  const mins = Math.floor((Date.now() - new Date(checkInTime).getTime()) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function ActiveSessionsList({ sessions }: { sessions: ActiveSession[] }) {
  const [checkedOutIds, setCheckedOutIds] = useState<Set<string>>(new Set());
  const visible = sessions.filter((s) => !checkedOutIds.has(s.id));

  if (visible.length === 0) {
    return (
      <div className="mt-16 text-center text-gray-400">
        <div className="text-5xl mb-3">🌤️</div>
        No children currently checked in.
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {visible.map((s) => (
        <SessionCard
          key={s.id}
          session={s}
          onCheckedOut={() => setCheckedOutIds((prev) => new Set(prev).add(s.id))}
        />
      ))}
    </div>
  );
}

function SessionCard({ session, onCheckedOut }: { session: ActiveSession; onCheckedOut: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showSettlePicker, setShowSettlePicker] = useState(false);

  const pendingOrders = session.cafeteria_orders.filter((o) => o.status === "pending");
  const hasPending = pendingOrders.length > 0;
  const pendingTotal = pendingOrders.reduce((sum, o) => sum + Number(o.price), 0);

  function handleAddItem(item: string, price: number) {
    setError(null);
    startTransition(async () => {
      const res = await addSessionItem({ checkInId: session.id, item, price });
      if (!res.ok) setError(res.error);
    });
  }

  function handleSettle(method: PaymentMethod) {
    setError(null);
    startTransition(async () => {
      const res = await settleCafeteriaPayment(session.id, method);
      if (!res.ok) setError(res.error);
      else setShowSettlePicker(false);
    });
  }

  function handleCheckOut() {
    if (hasPending) {
      setError("Settle the pending bill before checking out.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await confirmCheckOut(session.id);
      if (res.ok) onCheckedOut();
      else setError(res.error);
    });
  }

  return (
    <div
      className={`rounded-2xl shadow-md p-4 space-y-3 border-2 transition ${
        hasPending ? "border-red-400 bg-red-50" : "border-transparent bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-gray-900 flex items-center gap-1.5">
            {session.children_profiles?.child_name ?? "Unknown"}
            {hasPending && <span className="text-red-600">🔴</span>}
          </p>
          <p className="text-xs text-gray-500">
            Age {session.children_profiles?.child_age} · Parent: {session.children_profiles?.parent_name}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            ⏱️ In for {formatElapsed(session.check_in_time)} · {session.duration_booked}
          </p>
        </div>
        <button
          disabled={isPending}
          onClick={handleCheckOut}
          className="rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold px-4 py-2.5 text-sm shrink-0"
        >
          Check-Out
        </button>
      </div>

      {hasPending && (
        <div className="rounded-xl bg-red-100 border border-red-300 px-3 py-2 text-sm text-red-800">
          🚨 <span className="font-semibold">Pending payment:</span>{" "}
          {pendingOrders.map((o) => o.item).join(", ")} — total {pendingTotal}
        </div>
      )}

      {/* Extra Hours — sits above cafeteria items */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">⏰ Extra Hours</p>
        <div className="grid grid-cols-4 gap-2">
          {EXTRA_HOUR_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              disabled={isPending}
              onClick={() => handleAddItem(opt.label, opt.price)}
              className="flex flex-col items-center justify-center gap-0.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 py-2 text-[11px] font-medium text-amber-800 disabled:opacity-50"
            >
              <span>{opt.label}</span>
              <span className="text-[10px] text-amber-600">{opt.price}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cafeteria icon buttons */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">🍽️ Cafeteria</p>
        <div className="grid grid-cols-4 gap-2">
          {CAFETERIA_ITEMS.map((item) => (
            <button
              key={item}
              disabled={isPending}
              onClick={() => handleAddItem(item, CAFETERIA_PRICES[item])}
              className="flex flex-col items-center justify-center gap-0.5 rounded-xl bg-gray-50 hover:bg-indigo-50 border border-gray-200 py-2 text-[11px] font-medium text-gray-700 disabled:opacity-50 text-center leading-tight"
              title={`${item} · ${CAFETERIA_PRICES[item]}`}
            >
              <span className="text-lg leading-none">{CAFETERIA_ICONS[item]}</span>
              {item}
            </button>
          ))}
        </div>
      </div>

      {hasPending && !showSettlePicker && (
        <button
          disabled={isPending}
          onClick={() => setShowSettlePicker(true)}
          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 text-sm"
        >
          💳 Settle Payment ({pendingTotal})
        </button>
      )}

      {hasPending && showSettlePicker && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">Paid with:</p>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                disabled={isPending}
                onClick={() => handleSettle(m)}
                className="rounded-xl bg-gray-50 hover:bg-emerald-50 border border-gray-200 py-2.5 text-sm font-medium text-gray-700 disabled:opacity-50"
              >
                {PAYMENT_METHOD_ICONS[m]} {m}
              </button>
            ))}
          </div>
          <button
            disabled={isPending}
            onClick={() => setShowSettlePicker(false)}
            className="w-full rounded-xl bg-gray-100 text-gray-500 text-xs py-2"
          >
            Cancel
          </button>
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
    </div>
  );
}

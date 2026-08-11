"use client";

import { useState, useTransition } from "react";
import Scanner from "./Scanner";
import { fetchAndValidateChild, confirmCheckIn } from "../actions";
import type { ValidationResult, PaymentMethod } from "@/lib/types";
import { DURATION_PRICES, PAYMENT_METHODS, PAYMENT_METHOD_ICONS } from "@/lib/types";

type Step = "idle" | "loading" | "result" | "success";

export default function CheckInDashboard() {
  const [step, setStep] = useState<Step>("idle");
  const [manualId, setManualId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [duration, setDuration] = useState<string>("1 Hour");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [isPending, startTransition] = useTransition();

  function handleScan(id: string) {
    lookup(id);
  }

  function lookup(id: string) {
    setError(null);
    setStep("loading");
    startTransition(async () => {
      const res = await fetchAndValidateChild(id);
      if (!res.ok) {
        setError(res.error);
        setStep("idle");
        return;
      }
      setResult(res.data);
      setStep("result");
    });
  }

  function handleConfirmCheckIn() {
    if (!result) return;
    setError(null);
    startTransition(async () => {
      const res = await confirmCheckIn({
        childId: result.child.id,
        duration,
        paymentMethod,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setStep("success");
    });
  }

  function reset() {
    setResult(null);
    setError(null);
    setManualId("");
    setDuration("1 Hour");
    setPaymentMethod("Cash");
    setStep("idle");
  }

  return (
    <div className="max-w-md mx-auto w-full px-4 pb-10">
      {step === "idle" && (
        <div className="space-y-5 mt-4">
          <Scanner onResult={handleScan} />

          <div className="flex items-center gap-3 text-gray-400 text-sm">
            <div className="h-px bg-gray-200 flex-1" />
            or enter manually
            <div className="h-px bg-gray-200 flex-1" />
          </div>

          <div className="flex gap-2">
            <input
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder="Paste Parent/Child ID"
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              disabled={!manualId || isPending}
              onClick={() => lookup(manualId)}
              className="rounded-xl bg-indigo-600 disabled:opacity-40 text-white font-semibold px-5"
            >
              Go
            </button>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">
              {error}
            </div>
          )}
        </div>
      )}

      {step === "loading" && (
        <div className="mt-16 text-center text-gray-500">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
          Looking up profile…
        </div>
      )}

      {step === "result" && result && (
        <ValidationView
          result={result}
          duration={duration}
          setDuration={setDuration}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          onConfirm={handleConfirmCheckIn}
          onCancel={reset}
          isPending={isPending}
          error={error}
        />
      )}

      {step === "success" && result && (
        <div className="mt-10 text-center space-y-4">
          <div className="text-6xl">✅</div>
          <h2 className="text-xl font-bold text-gray-800">
            {result.child.child_name} checked in!
          </h2>
          <p className="text-gray-500">
            {duration} · {DURATION_PRICES[duration]} · {paymentMethod}
          </p>
          <button
            onClick={reset}
            className="w-full rounded-xl bg-indigo-600 text-white font-semibold py-3.5"
          >
            Scan Next Child
          </button>
        </div>
      )}
    </div>
  );
}

function ValidationView({
  result,
  duration,
  setDuration,
  paymentMethod,
  setPaymentMethod,
  onConfirm,
  onCancel,
  isPending,
  error,
}: {
  result: ValidationResult;
  duration: string;
  setDuration: (d: string) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (p: PaymentMethod) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
  error: string | null;
}) {
  const { child, rules, canCheckIn } = result;

  return (
    <div className="mt-4 space-y-4">
      {/* Header card */}
      <div className="bg-white rounded-2xl shadow-md p-5 flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center text-2xl overflow-hidden shrink-0">
          {child.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={child.photo_url} alt={child.child_name} className="h-full w-full object-cover" />
          ) : (
            "🧒"
          )}
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">{child.child_name}</h2>
          <p className="text-sm text-gray-500">
            Age {child.child_age} · Parent: {child.parent_name}
          </p>
          <p className="text-xs text-gray-400">Entry: {child.entry_type}</p>
        </div>
      </div>

      {/* Global safety alerts */}
      {(child.allergies || child.medical_info) && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 space-y-1">
          {child.allergies && (
            <p className="text-red-700 font-semibold text-sm">🚨 ALLERGY: {child.allergies}</p>
          )}
          {child.medical_info && (
            <p className="text-red-700 text-sm">🩺 {child.medical_info}</p>
          )}
        </div>
      )}

      {(child.emergency_contact_name || child.emergency_contact_phone) && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          📞 <span className="font-semibold">Emergency Contact:</span>{" "}
          {child.emergency_contact_name} {child.emergency_contact_phone && `— ${child.emergency_contact_phone}`}
        </div>
      )}

      {/* Rule checklist */}
      <div className="rounded-2xl bg-white shadow-md p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Entry Rules
        </h3>
        {rules.map((rule) => (
          <div
            key={rule.key}
            className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
              rule.severity === "blocking" && !rule.passed
                ? "bg-red-50 text-red-700"
                : rule.severity === "warning"
                ? "bg-amber-50 text-amber-800"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            <span>{rule.passed ? (rule.severity === "warning" ? "⚠️" : "✅") : "❌"}</span>
            <span>{rule.message}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
      )}

      {/* Payment section — only if all blocking rules passed */}
      {canCheckIn ? (
        <div className="rounded-2xl bg-white shadow-md p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            💳 Proceed to Payment
          </h3>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Stay Duration</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(DURATION_PRICES).map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`rounded-xl py-2.5 text-sm font-medium border transition ${
                    duration === d
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-gray-50 text-gray-700 border-gray-200"
                  }`}
                >
                  {d} · {DURATION_PRICES[d]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`rounded-xl py-2.5 text-sm font-medium border transition ${
                    paymentMethod === m
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-gray-50 text-gray-700 border-gray-200"
                  }`}
                >
                  {PAYMENT_METHOD_ICONS[m]} {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center text-sm text-gray-600 pt-1">
            <span>Total</span>
            <span className="text-lg font-bold text-gray-900">{DURATION_PRICES[duration]}</span>
          </div>

          <button
            disabled={isPending}
            onClick={onConfirm}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3.5 shadow-md"
          >
            {isPending ? "Processing…" : "✅ Confirm Check-In"}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl bg-red-100 border border-red-300 p-4 text-center text-red-800 font-semibold">
          🚫 Check-in blocked until the above issue is resolved.
        </div>
      )}

      <button
        onClick={onCancel}
        className="w-full rounded-xl bg-gray-100 text-gray-600 font-medium py-3"
      >
        ← Scan a different child
      </button>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

type ScannerProps = {
  onResult: (decodedText: string) => void;
};

export default function Scanner({ onResult }: ScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const containerId = "qr-reader-region";
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    (async () => {
      // Dynamic import: html5-qrcode touches `window`/`navigator`,
      // so it must never load during server-side rendering.
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;

      const html5Qrcode = new Html5Qrcode(containerId);
      scannerRef.current = html5Qrcode;

      try {
        await html5Qrcode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            onResult(decodedText);
            stopScanner();
          },
          () => {
            // per-frame scan failures — expected while aiming, ignore
          }
        );
      } catch (err: any) {
        setCameraError(
          "Could not access camera. Check browser permissions, or use manual entry below."
        );
      }
    })();

    return () => {
      cancelled = true;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function stopScanner() {
    const instance = scannerRef.current;
    if (instance) {
      try {
        await instance.stop();
        await instance.clear();
      } catch {
        // already stopped
      }
      scannerRef.current = null;
    }
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setCameraError(null);
          setIsOpen(true);
        }}
        className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-lg py-5 shadow-lg flex items-center justify-center gap-2 transition"
      >
        📷 Start Scanner
      </button>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-md bg-black">
      <div id={containerId} className="w-full" />
      {cameraError && (
        <div className="bg-red-50 text-red-700 text-sm p-3">{cameraError}</div>
      )}
      <button
        onClick={stopScanner}
        className="w-full bg-gray-800 hover:bg-gray-900 text-white font-medium py-3"
      >
        ✕ Close Camera
      </button>
    </div>
  );
}

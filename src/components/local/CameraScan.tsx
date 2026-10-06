"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

interface Detector { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> }
type DetectorCtor = new (o: { formats: string[] }) => Detector;

/**
 * Scan a barcode with the device's camera (a phone or a laptop): the browser's own barcode reader
 * (GS1 DataMatrix, GS1-128, EAN, QR). Where the browser has none, it says so — a USB / Bluetooth
 * scanner typing into the field still works everywhere.
 */
export function CameraScan({ onCode, label = "مسح بالكاميرا" }: { onCode: (raw: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null, timer = 0, alive = true;
    (async () => {
      const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
      if (!Ctor || !navigator.mediaDevices?.getUserMedia) { setMsg("هذا المتصفح لا يقرأ الباركود بالكاميرا — استعمل Chrome على الهاتف أو قارئ باركود."); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!alive || !video.current) return;
        video.current.srcObject = stream; await video.current.play();
        const det = new Ctor({ formats: ["data_matrix", "code_128", "ean_13", "ean_8", "qr_code", "upc_a"] });
        const tick = async () => {
          if (!alive || !video.current) return;
          const found = await det.detect(video.current).catch(() => []);
          if (found[0]?.rawValue) { onCode(found[0].rawValue); setOpen(false); return; }
          timer = window.setTimeout(tick, 250);
        };
        void tick();
      } catch { setMsg("تعذّر فتح الكاميرا — اسمح للمتصفح باستعمالها."); }
    })();
    return () => { alive = false; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, [open, onCode]);
  return (
    <>
      <button type="button" onClick={() => { setMsg(""); setOpen(true); }} data-testid="camera-scan" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas"><Camera className="size-4" /> {label}</button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-label="مسح بالكاميرا">
          <div className="w-full max-w-md rounded-2xl bg-surface p-3">
            <div className="mb-2 flex items-center justify-between text-sm font-semibold">وجّه الكاميرا إلى باركود العلبة<button type="button" onClick={() => setOpen(false)} aria-label="إغلاق"><X className="size-5" /></button></div>
            {msg ? <p className="py-6 text-center text-sm text-muted">{msg}</p> : <video ref={video} muted playsInline className="w-full rounded-lg bg-black" />}
          </div>
        </div>
      )}
    </>
  );
}

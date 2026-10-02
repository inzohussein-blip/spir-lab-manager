"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { syncMasterOn } from "@/lib/sync/protocol";
import { PauseCircle } from "lucide-react";

/** Shown in «محطة المزامنة» while sync is switched off on this computer («الحماية»). */
export function PausedNotice() {
  return (
    <div data-testid="sync-paused" className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <PauseCircle className="size-5 shrink-0" />
      <span className="min-w-0 flex-1"><b>المزامنة موقوفة على هذا الحاسوب.</b> لا يُرسل شيء ولا يُستقبل — لا تلقائياً ولا بملف — حتى تشغيلها. تبقى البيانات كما هي.</span>
      <Link href="/sync/settings#protect" className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">تشغيل المزامنة</Link>
    </div>
  );
}

/** The notice, only while sync is switched off (checked after the page opens). */
export function PausedBanner() {
  const [paused, setPaused] = useState(false);
  useEffect(() => { setPaused(!syncMasterOn()); }, []);
  return paused ? <PausedNotice /> : null;
}

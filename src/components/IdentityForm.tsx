"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateLabIdentity } from "@/app/actions/settings";
import { notifySaved } from "@/components/SettingsLayout";

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

/** Settings → the lab's name and letterhead lines (saved together, then «حُفظ ✓»). */
export function IdentityForm({ name, subtitle, footer, placeholder }: { name: string; subtitle: string; footer: string; placeholder: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <form data-testid="identity-form" className="flex flex-col gap-3"
      action={async (fd) => { setBusy(true); await updateLabIdentity(fd); setBusy(false); notifySaved(); router.refresh(); }}>
      <label className="text-sm font-medium">
        اسم المختبر
        <input name="name" defaultValue={name} maxLength={120} placeholder={placeholder} className={`mt-1 ${field}`} />
      </label>
      <label className="text-sm font-medium">
        السطر تحت اسم المختبر (المؤهّل / الوصف)
        <input name="subtitle" defaultValue={subtitle} maxLength={300} className={`mt-1 ${field}`} />
      </label>
      <label className="text-sm font-medium">
        العنوان ورقم الهاتف (أسفل التقرير والوصل)
        <input name="footer" defaultValue={footer} maxLength={300} placeholder="العنوان - الهاتف" className={`mt-1 ${field}`} />
      </label>
      <div>
        <button disabled={busy} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
      </div>
    </form>
  );
}

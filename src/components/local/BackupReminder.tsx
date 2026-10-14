"use client";

import { useEffect, useState } from "react";
import { Archive, Loader2 } from "lucide-react";
import { backupState, backupTick, downloadFullBackup, reminderDue, saveNow, setBackupState, BACKUP_EVENT, DAY } from "@/lib/local/fullBackup";

/** In every station: saves to the lab's folder when due («النسخة الشاملة ← الحفظ التلقائي»), and
 *  asks for a full backup when there has been none for a week. No link to «محطة المزامنة» (the
 *  stations do not link to each other): the backup downloads from here. */
export function BackupReminder({ raised }: { raised?: boolean }) {
  const [due, setDue] = useState<{ days: number; never: boolean } | null>(null);
  const [folder, setFolder] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const upd = () => { setDue(reminderDue()); const s = backupState(); setFolder(!!(s.folder && s.every)); };
    void backupTick().finally(upd);
    window.addEventListener(BACKUP_EVENT, upd);
    return () => window.removeEventListener(BACKUP_EVENT, upd);
  }, []);
  if (!due) return null;
  const act = async () => { setBusy(true); try { if (folder && (await saveNow(true))) return; await downloadFullBackup(); } finally { setBusy(false); } };
  return (
    <div role="status" data-testid="backup-reminder" className={`no-print fixed left-4 z-[80] flex max-w-sm flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow-[var(--shadow-pop)] ${raised ? "bottom-20" : "bottom-4"}`}>
      <Archive className="size-4 shrink-0" />
      <span className="flex-1">
        {due.never ? `لم تُؤخذ نسخة شاملة لبيانات المحطات منذ ${due.days} يوم.` : `آخر نسخة شاملة قبل ${due.days} يوم.`} البيانات على هذا الجهاز فقط.
      </span>
      <button onClick={() => void act()} disabled={busy} data-testid="backup-reminder-go" className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
        {busy && <Loader2 className="size-3.5 animate-spin" />} {folder ? "حفظ في المجلد" : "تنزيل نسخة"}
      </button>
      <button onClick={() => setBackupState({ snooze: Date.now() + DAY })} className="rounded-md px-2 py-1 text-xs hover:bg-amber-100">لاحقاً</button>
    </div>
  );
}

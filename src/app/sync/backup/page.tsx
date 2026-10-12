"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, Download, Upload, FolderOpen, FolderSync, FileSearch, Check, Loader2, AlertTriangle, CheckCircle2, X } from "lucide-react";
import {
  backupState, backupSummary, chooseFolder, downloadFullBackup, folderSupported, isFullBackup, restoreFullBackup, saveNow, stopAutoSave,
  BACKUP_EVENT, KEEP_FILES, REMIND_DAYS, type BackupState, type FullBackup,
} from "@/lib/local/fullBackup";
import { card, btn, when } from "@/components/sync/parts";
import { PageHead, StationTile } from "@/components/sync/ui";

/** «النسخة الشاملة»: every station of this computer in one file, saved by hand or to a folder by itself. */
export default function FullBackupPage() {
  const [s, setS] = useState<BackupState>({});
  const [canFolder, setCanFolder] = useState(false);
  const [every, setEvery] = useState(1);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState<FullBackup | null>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const upd = () => { const v = backupState(); setS(v); if (v.every) setEvery(v.every); };
    upd(); setCanFolder(folderSupported());
    window.addEventListener(BACKUP_EVENT, upd);
    return () => window.removeEventListener(BACKUP_EVENT, upd);
  }, []);

  async function run(what: string, fn: () => Promise<unknown>) { setBusy(what); setMsg(null); try { await fn(); } finally { setBusy(""); } }
  async function read(f: File) {
    setMsg(null); setPending(null);
    let raw: unknown;
    try { raw = JSON.parse(await f.text()); } catch { setMsg({ ok: false, text: "تعذّرت قراءة الملف." }); return; }
    if (!isFullBackup(raw)) { setMsg({ ok: false, text: "هذا الملف ليس «نسخة شاملة» (اختر الملف الذي نزّلته هذه الصفحة: spir-lab-backup-…)." }); return; }
    setPending(raw);
  }
  async function restore() {
    if (!pending) return;
    if (!window.confirm("استبدال كل بيانات المحطات على هذا الجهاز بما في النسخة؟ ما ليس في النسخة يُحذف من هذا الجهاز.")) return;
    await run("restore", async () => { await restoreFullBackup(pending); setPending(null); });
    setMsg({ ok: true, text: "استُعيدت النسخة الشاملة — يُعاد فتح الصفحة…" });
    setTimeout(() => location.reload(), 900);
  }

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <PageHead icon={<Archive />} title="النسخة الشاملة"
        sub="ملف واحد فيه كل المحطات على هذا الجهاز (والصور والمظهر)، بدل نسخة لكل محطة. به تنقل المختبر إلى حاسوب آخر أو إلى النسخة المحلية من التطبيق." />

      <p className="text-sm text-muted" data-testid="backup-last">
        {s.last ? <>آخر نسخة شاملة: <b>{when(s.last)}</b></> : "لم تُؤخذ نسخة شاملة على هذا الجهاز بعد."}
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={`${card} flex flex-col`}>
          <div className="mb-1 flex items-center gap-2 font-bold"><Download className="size-4 text-brand" /> تنزيل نسخة الآن</div>
          <p className="mb-3 text-xs text-muted">احفظ الملف خارج هذا الحاسوب (فلاشة، بريد، مجلد سحابي). لا يحوي رمز المختبر ولا هوية هذا الحاسوب في المزامنة.</p>
          <button type="button" disabled={!!busy} onClick={() => void run("download", downloadFullBackup)} data-testid="full-backup-download"
            className={`${btn} mt-auto w-full bg-brand py-3 text-white hover:bg-brand-dark disabled:opacity-60`}>
            {busy === "download" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} تنزيل النسخة الشاملة
          </button>
        </section>

        <section className={card} data-testid="auto-save">
          <div className="mb-1 flex items-center gap-2 font-bold"><FolderSync className="size-4 text-brand" /> الحفظ التلقائي في مجلد</div>
          {!canFolder ? (
            <p className="text-xs text-muted">هذا المتصفح لا يسمح بالحفظ في مجلد. استعمل Chrome أو Edge على الحاسوب، أو نزّل النسخة بنفسك؛ وستذكّرك المحطات إن مرّ {REMIND_DAYS} أيام بلا نسخة.</p>
          ) : s.folder && s.every ? (
            <>
              <p className="mb-2 text-sm">تُحفظ نسخة في المجلد «<b>{s.folder}</b>» {s.every === 1 ? "كل يوم" : `كل ${s.every} أيام`} عند فتح أي محطة، وتبقى آخر {KEEP_FILES} نسخ.</p>
              {s.failed && (
                <p className="mb-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800" data-testid="auto-save-failed">
                  <AlertTriangle className="size-3.5 shrink-0" /> آخر حفظ لم يتم: المتصفح يطلب السماح بالمجلد من جديد. اضغط «حفظ الآن».
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!!busy} onClick={() => void run("save", async () => setMsg((await saveNow(true)) ? { ok: true, text: "حُفظت نسخة في المجلد." } : { ok: false, text: "تعذّر الحفظ في المجلد — اختره من جديد." }))}
                  className={`${btn} bg-brand text-white hover:bg-brand-dark disabled:opacity-60`} data-testid="auto-save-now">
                  {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} حفظ الآن
                </button>
                <button type="button" onClick={() => void stopAutoSave()} className={`${btn} border border-line hover:bg-canvas`}><X className="size-4" /> إيقاف</button>
              </div>
            </>
          ) : (
            <>
              <p className="mb-3 text-xs text-muted">اختر مجلداً على هذا الحاسوب (يُفضّل مجلداً تتزامن نسخته مع حساب سحابي) فتُحفظ فيه نسخة بنفسها عند فتح المحطات.</p>
              <div className="flex flex-wrap items-center gap-2">
                <select value={every} onChange={(e) => setEvery(Number(e.target.value))} aria-label="تكرار الحفظ" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                  <option value={1}>كل يوم</option>
                  <option value={7}>كل أسبوع</option>
                </select>
                <button type="button" disabled={!!busy} onClick={() => void run("folder", async () => { if (await chooseFolder(every)) setMsg({ ok: true, text: "اختير المجلد وحُفظت فيه أول نسخة." }); })}
                  className={`${btn} bg-brand text-white hover:bg-brand-dark disabled:opacity-60`} data-testid="auto-save-folder">
                  {busy === "folder" ? <Loader2 className="size-4 animate-spin" /> : <FolderOpen className="size-4" />} اختيار المجلد
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      <section className={card}>
        <div className="mb-1 flex items-center gap-2 font-bold"><Upload className="size-4 text-brand" /> استعادة نسخة شاملة</div>
        <p className="mb-3 text-xs text-muted">على حاسوب جديد، أو في النسخة المحلية من التطبيق: اختر الملف، راجع ما فيه، ثم استعده. تحلّ بياناته محلّ بيانات المحطات على هذا الجهاز.</p>
        <button type="button" disabled={!!busy} onClick={() => file.current?.click()} className={`${btn} border border-line hover:bg-canvas`} data-testid="full-backup-pick">
          <Upload className="size-4" /> اختيار ملف النسخة
        </button>
        <input ref={file} type="file" accept="application/json,.json" hidden aria-label="ملف النسخة الشاملة" data-testid="full-backup-file"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ""; }} />
      </section>

      {pending && (
        <section className={`${card} border-2 border-brand`} data-testid="full-backup-preview">
          <div className="mb-2 flex items-center gap-2 font-bold"><FileSearch className="size-4 text-brand" /> قبل الاستعادة: ما في النسخة</div>
          <p className="mb-3 text-sm">{pending.from ? <>من «<b>{pending.from}</b>» — </> : null}أُخذت {when(pending.at)}{pending.images?.length ? ` — ${pending.images.length} صورة` : ""}</p>
          <ul className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {backupSummary(pending).map(([st, n]) => <StationTile key={st} id={st} n={n} />)}
          </ul>
          <div className="flex gap-2">
            <button type="button" disabled={!!busy} onClick={() => void restore()} className={`${btn} bg-brand text-white hover:bg-brand-dark disabled:opacity-60`} data-testid="full-backup-restore">
              {busy === "restore" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} استعادة النسخة
            </button>
            <button type="button" onClick={() => setPending(null)} className={`${btn} border border-line hover:bg-canvas`}>إلغاء</button>
          </div>
        </section>
      )}

      {msg && (
        <p role="status" data-testid="full-backup-msg" className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${msg.ok ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-700"}`}>
          {msg.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />} {msg.text}
        </p>
      )}
    </div>
  );
}

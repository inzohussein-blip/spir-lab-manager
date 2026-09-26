"use client";

import { useEffect, useRef, useState } from "react";
import { Settings, Check, Image as ImageIcon, Download, Upload, Trash2, Stethoscope, Plus, Pencil, X, Smartphone, History, ListCollapse, ClipboardList } from "lucide-react";
import {
  getSettings, saveSettings, exportBackup, importBackup, getDoctors, saveDoctors, markBackupNow, daysSinceBackup, getVisits, storageUsage, requestPersistentStorage, uid,
  type StationSettings, type StationDoctor,
} from "@/lib/station/store";
import { InstallButton } from "@/components/station/InstallButton";
import { TableStyleCard } from "@/components/station/TableStyleCard";
import { ThemeCard } from "@/components/local/LocalTheme";
import { LABEL_SIZES, type LabelSize } from "@/components/station/TubeLabel";
import { THEME_KEYS } from "@/lib/local/theme";
import { OfflineStatusLine } from "@/components/local/OfflineReady";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

export default function StationSettingsPage() {
  const [s, setS] = useState<StationSettings>({ labName: "", labSubtitle: "" });
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  // Referring doctors CRUD
  const [doctors, setDoctors] = useState<StationDoctor[]>([]);
  const [dName, setDName] = useState("");
  const [dClinic, setDClinic] = useState("");
  const [dEdit, setDEdit] = useState<string | null>(null);
  const [since, setSince] = useState<number | null>(null);
  const [hasData, setHasData] = useState(false);
  const [usage, setUsage] = useState({ bytes: 0, pct: 0, visits: 0 });
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const overdue = hasData && (since === null || since >= 7);

  useEffect(() => {
    setS(getSettings()); setDoctors(getDoctors());
    setSince(daysSinceBackup()); setHasData(getVisits().length > 0);
    setUsage(storageUsage());
    requestPersistentStorage().then(setPersisted);
  }, []);

  function persistDoctors(next: StationDoctor[]) { setDoctors(next); saveDoctors(next); }
  function submitDoctor() {
    if (!dName.trim()) return;
    const rec: StationDoctor = { id: dEdit ?? uid(), name: dName.trim(), clinic: dClinic.trim() || undefined };
    persistDoctors(dEdit ? doctors.map((d) => (d.id === dEdit ? rec : d)) : [...doctors, rec]);
    setDName(""); setDClinic(""); setDEdit(null);
  }
  function editDoctor(d: StationDoctor) { setDName(d.name); setDClinic(d.clinic ?? ""); setDEdit(d.id); }
  function delDoctor(id: string) {
    if (!window.confirm("حذف هذا الطبيب؟")) return;
    persistDoctors(doctors.filter((d) => d.id !== id));
    if (dEdit === id) { setDName(""); setDClinic(""); setDEdit(null); }
  }

  function save(next?: StationSettings) {
    const v = next ?? s;
    const clean = { ...v, labName: v.labName.trim() || "مختبر", labSubtitle: v.labSubtitle.trim() };
    saveSettings(clean);
    setS(clean);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  // Result options save immediately and independently of the letterhead form.
  function setOption(patch: Partial<StationSettings>) {
    saveSettings({ ...getSettings(), ...patch });
    setS((cur) => ({ ...cur, ...patch }));
  }

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 400 * 1024) { setMsg("حجم الصورة كبير — اختر صورة أصغر من 400KB."); return; }
    const reader = new FileReader();
    reader.onload = () => save({ ...s, logo: String(reader.result) });
    reader.readAsDataURL(file);
  }

  function doExport() {
    const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `station-backup-${new Date().toLocaleDateString("en-CA")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    markBackupNow();
    setSince(0);
    setMsg("تم تصدير النسخة الاحتياطية.");
  }

  function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const ok = importBackup(JSON.parse(String(reader.result)));
        setMsg(ok ? "تم الاستيراد بنجاح — سيُعاد التحميل." : "لم يكتمل الاستيراد: الملف غير صالح أو أن مساحة التخزين في المتصفح لا تكفي.");
        if (ok) setTimeout(() => location.reload(), 900);
      } catch {
        setMsg("تعذّرت قراءة الملف.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-5 flex items-center gap-2 text-2xl font-bold"><Settings className="size-6" /> إعدادات المحطة</h1>

      {/* Appearance */}
      <ThemeCard storageKey={THEME_KEYS.station} />

      {/* Report letterhead */}
      <div className="mb-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-3 text-sm font-semibold">ترويسة التقرير المطبوع</div>
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">اسم المختبر
            <input value={s.labName} onChange={(e) => setS({ ...s, labName: e.target.value })} className={`mt-1 ${inp}`} />
          </label>
          <label className="text-sm font-medium">العنوان الفرعي
            <input value={s.labSubtitle} onChange={(e) => setS({ ...s, labSubtitle: e.target.value })} className={`mt-1 ${inp}`} />
          </label>
          <label className="text-sm font-medium">سطر التذييل (العنوان / الهاتف)
            <input value={s.footer ?? ""} onChange={(e) => setS({ ...s, footer: e.target.value })} placeholder="العنوان - الهاتف" className={`mt-1 ${inp}`} />
          </label>

          <Toggle
            checked={s.labQr !== false}
            onChange={(v) => setOption({ labQr: v })}
            label="رمز معلومات المختبر (QR) أسفل التقرير"
            desc="مربع صغير بجانب التوقيع يقرؤه أي هاتف بالكاميرا فيعرض معلومات المختبر. باركود المراجع يُطبع أعلى اليمين بجانب بيانات المريض."
          />
          {s.labQr !== false && (
            <label className="text-sm font-medium">نص رمز المختبر (اختياري)
              <textarea
                value={s.labQrText ?? ""}
                onChange={(e) => setS({ ...s, labQrText: e.target.value })}
                rows={3}
                placeholder={[s.labName, s.labSubtitle, s.footer].map((x) => x?.trim()).filter(Boolean).join("\n") || "اسم المختبر، العنوان، الهاتف، رابط الموقع…"}
                className={`mt-1 ${inp}`}
              />
              <span className="block text-xs font-normal text-muted">إذا تُرك فارغاً يحمل الرمز اسم المختبر والعنوان الفرعي وسطر التذييل. يمكنك كتابة رقم أو رابط موقع المختبر على الخريطة. اضغط «حفظ» بعد التعديل.</span>
            </label>
          )}

          <div className="text-sm font-medium">شعار المختبر</div>
          <div className="flex items-center gap-3">
            {s.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logo} alt="logo" className="size-14 rounded-lg border border-line object-contain p-1" />
            ) : (
              <span className="grid size-14 place-items-center rounded-lg border border-dashed border-line text-muted">
                <ImageIcon className="size-5" />
              </span>
            )}
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
              <Upload className="size-4" /> رفع شعار
              <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
            </label>
            {s.logo && (
              <button onClick={() => save({ ...s, logo: undefined })} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline">
                <Trash2 className="size-3.5" /> إزالة
              </button>
            )}
          </div>

          <button onClick={() => save()} className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            <Check className="size-4" /> حفظ
          </button>
          {saved && <p className="text-xs text-brand-dark">تم الحفظ.</p>}
        </div>
      </div>

      {/* Previous-result options */}
      <div className="mb-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><History className="size-4" /> النتيجة السابقة للمراجع</div>
        <div className="flex flex-col gap-3">
          <Toggle
            checked={s.showPrevious !== false}
            onChange={(v) => setOption({ showPrevious: v })}
            label="إظهار النتيجة السابقة للفاحص"
            desc="تظهر تحت حقل النتيجة في شاشة الإدخال فقط، ولا تُطبع."
          />
          <Toggle
            checked={s.printPrevious === true}
            onChange={(v) => setOption({ printPrevious: v })}
            label="طباعة النتيجة السابقة مع الجديدة"
            desc="يضيف عمود «النتيجة السابقة» إلى ورقة النتائج المطبوعة."
          />
        </div>
      </div>

      {/* Printed results table */}
      <TableStyleCard settings={s} onChange={(t) => setOption({ reportTable: t })} />

      {/* Entry-screen options */}
      <div className="mb-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><ListCollapse className="size-4" /> شاشة الإدخال</div>
        <Toggle
          checked={s.autoDerived === true}
          onChange={(v) => setOption({ autoDerived: v })}
          label="الحساب التلقائي للفحوصات المشتقة"
          desc="عند اختيار الفحص المشتق مع فحوصاته تُحسب النتيجة تلقائياً ويمكن تعديلها يدوياً: البيليروبين غير المباشر، الغلوبيولين، VLDL، LDL (Friedewald)، BUN، HOMA-IR."
        />
        {s.autoDerived === true && (
          <div className="mt-3 flex flex-col gap-3 border-s-2 border-line ps-4">
            <Toggle
              checked={s.derivedEgfr === true}
              onChange={(v) => setOption({ derivedEgfr: v })}
              label="حساب eGFR (CKD-EPI 2021)"
              desc="من الكرياتينين (mg/dL) والعمر بالسنوات والجنس — للبالغين 18 سنة فأكثر."
            />
            <Toggle
              checked={s.derivedSampson === true}
              onChange={(v) => setOption({ derivedSampson: v })}
              label="حساب LDL بمعادلة Sampson عندما تكون TG بين 400 و800"
              desc="بدل ترك LDL فارغاً حين لا تصلح معادلة Friedewald. فوق 800 يبقى فارغاً ويُنصح بالقياس المباشر."
            />
          </div>
        )}
        <div className="h-3" />
        <Toggle
          checked={s.tubeLabel === true}
          onChange={(v) => setOption({ tubeLabel: v })}
          label="طباعة ملصق الأنبوب"
          desc="يُظهر زر «ملصق الأنبوب» في شاشة الإدخال: اسم المريض، رقم العينة كباركود، والتاريخ — للصقه على أنبوب العينة."
        />
        {s.tubeLabel === true && (
          <div className="mt-3 grid gap-3 border-s-2 border-line ps-4 sm:grid-cols-2">
            <label className="text-xs text-muted">حجم الملصق
              <select value={s.labelSize ?? "50x25"} onChange={(e) => setOption({ labelSize: e.target.value as LabelSize })} className={`mt-1 ${inp}`}>
                {(Object.keys(LABEL_SIZES) as LabelSize[]).map((k) => <option key={k} value={k}>{LABEL_SIZES[k].label}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted">عدد الملصقات لكل مريض
              <select value={s.labelCopies ?? 1} onChange={(e) => setOption({ labelCopies: Number(e.target.value) })} className={`mt-1 ${inp}`}>
                {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <p className="text-[11px] text-muted sm:col-span-2">اختر طابعة الملصقات في نافذة الطباعة، واضبط الهوامش على «بلا» إن ظهرت.</p>
          </div>
        )}
        <div className="h-3" />
        <Toggle
          checked={s.collapseGroups === true}
          onChange={(v) => setOption({ collapseGroups: v })}
          label="طيّ مجموعات الفحوصات"
          desc="تُطوى كل مجموعة تحت عنوانها وتُفتح بالضغط عليه، والبحث يفتحها تلقائياً."
        />
        <div className="h-3" />
        <Toggle
          checked={s.ageUnit === true}
          onChange={(v) => setOption({ ageUnit: v })}
          label="وحدة العمر (سنة / شهر / يوم)"
          desc="قائمة بجانب حقل العمر بدل كتابة «6 أشهر» — مفيدة للأطفال ومعدلاتهم حسب العمر. السنوات تُحفظ رقماً كما هي."
        />
        <div className="h-3" />
        <Toggle
          checked={s.deliveryStatus === true}
          onChange={(v) => setOption({ deliveryStatus: v })}
          label="حالة تسليم النتائج"
          desc="في «الزيارات المحفوظة» عمود «التسليم» (لم تُسلَّم / سُلِّمت مع التاريخ)، وفلتر للزيارات غير المسلّمة، وتسليم عدة زيارات دفعة واحدة."
        />
      </div>

      {/* Report forms (urine, stool, semen, culture) */}
      <div className="mb-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><ClipboardList className="size-4" /> استمارات التقارير (البول، الخروج، السائل المنوي، الزرع)</div>
        <div className="flex flex-col gap-3">
          <Toggle
            checked={s.formBoldAbnormal !== false}
            onChange={(v) => setOption({ formBoldAbnormal: v })}
            label="تمييز النتيجة غير الطبيعية بخط عريض"
            desc="في الاستمارة المطبوعة تُطبع النتيجة المخالفة للقيمة الطبيعية أو للمعدل المطبوع بجانبها بخط عريض، بلا ألوان."
          />
          <Toggle
            checked={s.formHideEmpty === true}
            onChange={(v) => setOption({ formHideEmpty: v })}
            label="إخفاء الحقول الفارغة عند الطباعة"
            desc="الحقل الذي لم يُملأ لا يُطبع صفه، وكذلك العنوان الفرعي أو القسم الذي لم يُملأ منه شيء."
          />
          <Toggle
            checked={s.sfaDiagnosis !== false}
            onChange={(v) => setOption({ sfaDiagnosis: v })}
            label="الخلاصة التلقائية للسائل المنوي (Conclusion)"
            desc="تُحسب من القيم حسب المعدلات المطبوعة: Normozoospermia، Oligo/Astheno/Teratozoospermia، Azoospermia، مع Hypospermia وNecrozoospermia. تُطبع أسفل التقرير ويمكن استبدالها."
          />
          <Toggle
            checked={s.sfaAutoCalc !== false}
            onChange={(v) => setOption({ sfaAutoCalc: v })}
            label="الحساب التلقائي في السائل المنوي"
            desc="عند إدخال PR وNP يُحسب Total Motility وImmotile، وعند إدخال Normal تُحسب Abnormal (والعكس)، ومن التركيز والحجم يُحسب Total Sperm Count."
          />
          <Toggle
            checked={s.csTestedOnly === true}
            onChange={(v) => setOption({ csTestedOnly: v })}
            label="الزرع: طباعة المضادات المفحوصة فقط"
            desc="عند الإيقاف (الافتراضي) تُطبع قائمة المضادات كاملة كما في الورقة، والمضاد غير المفحوص يبقى فارغاً."
          />
          <Toggle
            checked={s.formExtraNormals === true}
            onChange={(v) => setOption({ formExtraNormals: v })}
            label="قيم طبيعية إضافية في محرر الاستمارات"
            desc="في «إدارة الفحوصات ← الاستمارة» يظهر لكل حقل «قيم أخرى تُعتبر طبيعية» وخيار «حقل وصفي»، لتحديد ما لا يُطبع بخط عريض."
          />
        </div>
      </div>

      {/* Referring doctors */}
      <div className="mb-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><Stethoscope className="size-4" /> الأطباء المُحيلون</div>
        <p className="mb-3 text-xs text-muted">تظهر هذه القائمة في «مصدر التحويل» بشاشة الإدخال إلى جانب «مريض خارجي».</p>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <label className="flex-1 text-sm font-medium">اسم الطبيب<input value={dName} onChange={(e) => setDName(e.target.value)} className={`mt-1 ${inp}`} /></label>
          <label className="flex-1 text-sm font-medium">العيادة (اختياري)<input value={dClinic} onChange={(e) => setDClinic(e.target.value)} className={`mt-1 ${inp}`} /></label>
          <button onClick={submitDoctor} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            <Plus className="size-4" /> {dEdit ? "حفظ" : "إضافة"}
          </button>
          {dEdit && <button onClick={() => { setDName(""); setDClinic(""); setDEdit(null); }} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-2 text-xs text-muted hover:bg-canvas"><X className="size-3.5" /></button>}
        </div>
        {doctors.length === 0 ? (
          <p className="text-sm text-muted">لا أطباء بعد.</p>
        ) : (
          <div className="flex flex-col divide-y divide-line rounded-lg border border-line">
            {doctors.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <div><span className="font-medium">{d.name}</span>{d.clinic && <span className="text-muted"> — {d.clinic}</span>}</div>
                <div className="flex gap-1">
                  <button onClick={() => editDoctor(d)} className="grid size-7 place-items-center rounded-lg border border-line hover:bg-canvas"><Pencil className="size-4" /></button>
                  <button onClick={() => delDoctor(d.id)} className="grid size-7 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Backup */}
      <div className={`rounded-2xl border bg-surface p-5 shadow-[var(--shadow-card)] ${overdue ? "border-amber-300" : "border-line"}`}>
        <div className="mb-1 text-sm font-semibold">النسخ الاحتياطي</div>
        {overdue && (
          <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            لم تأخذ نسخة احتياطية مؤخراً وبياناتك محفوظة على هذا الجهاز فقط — صدّر نسخة الآن.
          </div>
        )}
        <p className="mb-3 text-xs text-muted">
          كل البيانات محفوظة على هذا الحاسوب فقط. صدّر نسخة احتياطية بانتظام، أو انقلها إلى حاسوب آخر.
        </p>

        {/* Local storage usage */}
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-xs text-muted">
            <span>مساحة التخزين المحلية — {usage.visits} زيارة</span>
            <span className="tabular-nums">{(usage.bytes / 1024).toFixed(0)} KB · {usage.pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-canvas">
            <div className={`h-full rounded-full ${usage.pct >= 80 ? "bg-red-500" : usage.pct >= 60 ? "bg-amber-500" : "bg-brand"}`} style={{ width: `${Math.max(2, usage.pct)}%` }} />
          </div>
          {usage.pct >= 80 && (
            <p className="mt-1 text-xs font-medium text-red-600">اقتربت المساحة من الحد — صدّر نسخة واحذف زيارات قديمة.</p>
          )}
        </div>
        {/* Persistent-storage status */}
        {persisted !== null && (
          <div className={`mb-3 rounded-lg px-3 py-2 text-xs ${persisted ? "bg-brand-light text-brand-dark" : "bg-amber-50 text-amber-800"}`}>
            {persisted ? (
              <span className="font-medium">✓ الحفظ الدائم مفعّل — لن يحذف المتصفح بيانات المحطة تلقائياً.</span>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">الحفظ الدائم غير مفعّل بعد — ثبّت المحطة كتطبيق (بالأسفل) ثم أعد المحاولة.</span>
                <button onClick={() => requestPersistentStorage().then(setPersisted)} className="rounded-md border border-amber-300 px-2 py-0.5 hover:bg-amber-100">إعادة المحاولة</button>
              </span>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button onClick={doExport} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
            <Download className="size-4" /> تصدير نسخة احتياطية
          </button>
          <button onClick={() => importRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
            <Upload className="size-4" /> استيراد نسخة
          </button>
          <input ref={importRef} type="file" accept="application/json,.json" onChange={onImport} className="hidden" />
        </div>
        <p className={`mt-2 text-xs ${since != null && since >= 7 ? "text-amber-700" : "text-muted"}`}>
          {since == null ? "لم تُؤخذ نسخة احتياطية بعد." : since === 0 ? "آخر نسخة احتياطية: اليوم." : `آخر نسخة احتياطية قبل ${since} يوم.`}
        </p>
        {msg && <p className="mt-1 text-xs text-muted">{msg}</p>}
      </div>

      {/* Install as app (PWA) — Lab Station only */}
      <div className="mt-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><Smartphone className="size-4" /> تثبيت كتطبيق</div>
        <p className="mb-3 text-xs text-muted">ثبّت محطة المختبر كتطبيق مستقلّ يفتح مباشرةً على شاشة الإدخال ويعمل بدون إنترنت.</p>
        <InstallButton />
        <div className="mt-2"><OfflineStatusLine /></div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted">{desc}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full ${checked ? "bg-brand" : "bg-line"}`}
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${checked ? "start-[22px]" : "start-0.5"}`} />
      </button>
    </label>
  );
}

"use client";

import { SyncPanel } from "@/components/local/SyncPanel";
import { kvFlush } from "@/lib/local/kv";
import { useEffect, useRef, useState } from "react";
import { Settings, Image as ImageIcon, Download, Upload, Trash2, Stethoscope, Plus, Pencil, X, Smartphone, History, ListCollapse, ClipboardList, QrCode as QrCodeIcon, Hash, PenLine, RotateCcw, FileText, Building2, Phone, Eye, Calculator, Printer, Tag, Boxes, HardDrive, ShieldCheck } from "lucide-react";
import { labQrCode, QR_TITLE_DEFAULT, QR_HINT_DEFAULT } from "@/lib/station/labQr";
import { SettingsLayout, notifySaved } from "@/components/SettingsLayout";
import { ReportPreview } from "@/components/station/ReportPreview";
import {
  getSettings, saveSettings, normalizeUrl, exportBackup, importBackup, getDoctors, saveDoctors, markBackupNow, daysSinceBackup, getVisits, storageUsage, requestPersistentStorage, uid, type StorageUsage,
  getDeviceTag, setDeviceTag, resetBuiltinTests, restoreDefaultTests,
  type StationSettings, type StationDoctor,
} from "@/lib/station/store";
import { InstallButton } from "@/components/station/InstallButton";
import { TableStyleCard } from "@/components/station/TableStyleCard";
import { ORIGINAL_HEAD, PRE_BOTTOM_DEFAULT, PRE_TOP_DEFAULT, REPORT_FONTS, type ReportHead } from "@/lib/station/reportExtras";
import { ThemeCard } from "@/components/local/LocalTheme";
import { PinCard } from "@/components/local/PinGate";
import { SettingCard, Toggle, SubOptions, StockOptionsCard } from "@/components/local/SettingsParts";
import { LABEL_SIZES, type LabelSize } from "@/components/station/TubeLabel";
import { THEME_KEYS } from "@/lib/local/theme";
import { OfflineStatusLine } from "@/components/local/OfflineReady";
import { STATIC_IMAGES } from "@/lib/local/staticImages";

const inp = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

const mb = (n: number) => (n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(1)} GB` : `${(n / 1024 / 1024).toFixed(n >= 10 * 1024 * 1024 ? 0 : 1)} MB`);

export default function StationSettingsPage() {
  const [s, setS] = useState<StationSettings>({ labName: "", labSubtitle: "" });
  const [msg, setMsg] = useState("");
  const [logoMsg, setLogoMsg] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  // Referring doctors CRUD
  const [doctors, setDoctors] = useState<StationDoctor[]>([]);
  const [dName, setDName] = useState("");
  const [dClinic, setDClinic] = useState("");
  const [dEdit, setDEdit] = useState<string | null>(null);
  const [since, setSince] = useState<number | null>(null);
  const [hasData, setHasData] = useState(false);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [tag, setTag] = useState("");
  const [defaultsMsg, setDefaultsMsg] = useState("");
  const overdue = hasData && (since === null || since >= 7);

  useEffect(() => {
    setS(getSettings()); setDoctors(getDoctors()); setTag(getDeviceTag());
    setSince(daysSinceBackup()); setHasData(getVisits().length > 0);
    storageUsage().then(setUsage);
    requestPersistentStorage().then(setPersisted);
  }, []);

  function persistDoctors(next: StationDoctor[]) { setDoctors(next); saveDoctors(next); notifySaved(); }
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

  // Every setting saves as soon as it changes (text fields when you leave them), with «حُفظ ✓».
  function setOption(patch: Partial<StationSettings>) {
    saveSettings({ ...getSettings(), ...patch });
    setS((cur) => ({ ...cur, ...patch }));
    notifySaved();
  }

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 400 * 1024) { setLogoMsg("حجم الصورة كبير — اختر صورة أصغر من 400KB."); return; }
    setLogoMsg("");
    const reader = new FileReader();
    reader.onload = () => setOption({ logo: String(reader.result) });
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
        if (ok) void kvFlush().then(() => setTimeout(() => location.reload(), 900));
      } catch {
        setMsg("تعذّرت قراءة الملف.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // What is switched on in each section (shown beside its name).
  const onCount = (xs: boolean[]) => { const n = xs.filter(Boolean).length; return n ? `${n} مفعّل` : null; };
  const reportOn = onCount([s.reportBarcode !== false, s.labQr !== false, s.printPrevious === true, s.reportFill === true, s.signatureOn === true, s.prePrinted === true, s.reportHeadOn === true, s.reportFontOn === true]);
  const formsOn = onCount([s.formBoldAbnormal !== false, s.formHideEmpty === true, s.csTestedOnly === true, s.sfaDiagnosis !== false, s.sfaAutoCalc !== false, s.formExtraNormals === true]);
  const entryOn = onCount([s.entryPrintButton !== false, s.entryWhatsApp !== false, s.entryHighlight !== false, s.showPrevious !== false, s.autoDerived === true, s.tubeLabel === true, s.collapseGroups === true, s.ageUnit === true, s.deliveryStatus === true]);
  const preview = <ReportPreview settings={s} />;
  // A text setting: typed freely, saved when leaving the field.
  const text = (k: "labName" | "labSubtitle" | "footer" | "labPhone" | "labAddress" | "labUrl" | "labQrTitle" | "labQrHint" | "signatureName" | "signatureTitle", fallback = "") => ({
    value: (s[k] as string | undefined) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: e.target.value }),
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => setOption({ [k]: e.target.value.trim() || fallback }),
  });

  return (
    <SettingsLayout
      title="إعدادات محطة المختبر"
      icon={<Settings className="size-6" />}
      search
      sections={[
        {
          id: "lab", label: "المختبر", hint: "الاسم والشعار ومعلومات التواصل", icon: <Building2 />,
          aside: preview,
          content: (
            <>
              <SettingCard title="اسم المختبر وشعاره" icon={<Building2 />} desc="يظهر في رأس التقرير المطبوع. يُحفظ كل حقل عند الخروج منه." testid="lab-identity">
                <label className="text-sm font-medium">اسم المختبر
                  <input {...text("labName", "مختبر")} className={`mt-1 ${inp}`} />
                </label>
                <label className="text-sm font-medium">العنوان الفرعي
                  <input {...text("labSubtitle")} className={`mt-1 ${inp}`} />
                </label>
                <label className="text-sm font-medium">سطر التذييل (العنوان / الهاتف)
                  <input {...text("footer")} placeholder="العنوان - الهاتف" className={`mt-1 ${inp}`} />
                </label>
                <div>
                  <div className="text-sm font-medium">شعار المختبر</div>
                  <div className="mt-1 flex items-center gap-3">
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
                      <button onClick={() => setOption({ logo: undefined })} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline">
                        <Trash2 className="size-3.5" /> إزالة
                      </button>
                    )}
                  </div>
                  {logoMsg && <p className="mt-1 text-xs text-red-600">{logoMsg}</p>}
                </div>
              </SettingCard>

              <SettingCard title="معلومات التواصل" icon={<Phone />} desc="يحملها رمز QR أسفل التقرير (إعداداته في «التقرير المطبوع»)." testid="lab-contact">
                {(() => {
                  const badUrl = !!s.labUrl?.trim() && !normalizeUrl(s.labUrl);
                  return (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-sm font-medium">أرقام الهاتف
                          <input {...text("labPhone")} dir="ltr" inputMode="tel" placeholder="07XX XXX XXXX, 07XX XXX XXXX" className={`mt-1 text-left ${inp}`} />
                          <span className="block text-xs font-normal text-muted">أكثر من رقم؟ افصل بينها بفاصلة.</span>
                        </label>
                        <label className="text-sm font-medium">العنوان
                          <input {...text("labAddress")} placeholder="المدينة - الحي - أقرب نقطة دالة" className={`mt-1 ${inp}`} />
                        </label>
                      </div>
                      <label className="text-sm font-medium">رابط موقع المختبر
                        <input {...text("labUrl")} dir="ltr" inputMode="url" placeholder="https://maps.app.goo.gl/… أو رابط الموقع" className={`mt-1 text-left ${inp}`} />
                        <span className={`block text-xs font-normal ${badUrl ? "text-red-600" : "text-muted"}`}>
                          {badUrl ? "الرابط غير صحيح — اكتبه كاملاً بلا مسافات، مثل lab.com أو https://maps.app.goo.gl/…"
                            : "من خرائط Google: افتح موقع المختبر ← مشاركة ← نسخ الرابط، ثم الصقه هنا."}
                        </span>
                      </label>
                    </>
                  );
                })()}
              </SettingCard>
            </>
          ),
        },
        {
          id: "report", label: "التقرير المطبوع", hint: "الشكل والألوان وما يظهر على الورقة", icon: <FileText />, badge: reportOn,
          aside: preview,
          content: (
            <>
              <TableStyleCard settings={s} onChange={(t) => setOption({ reportTable: t })} />

              <SettingCard title="ما يظهر على الورقة" icon={<Eye />} desc="تظهر النتيجة في المعاينة بجانب الإعدادات." testid="report-content">
                <Toggle
                  checked={s.reportBarcode !== false}
                  onChange={(v) => setOption({ reportBarcode: v })}
                  label="باركود رقم العينة بجانب معلومات المريض"
                  desc="في أعلى التقرير تحت التاريخ. عند الإيقاف يُطبع رقم العينة وحده بلا باركود."
                />
                <Toggle
                  checked={s.printPrevious === true}
                  onChange={(v) => setOption({ printPrevious: v })}
                  label="طباعة النتيجة السابقة مع الجديدة"
                  desc="يضيف عمود «النتيجة السابقة» إلى جدول النتائج."
                />
                <Toggle
                  checked={s.reportFill === true}
                  onChange={(v) => setOption({ reportFill: v })}
                  label="ملء الصفحة عند قلة الفحوصات"
                  desc="إذا كانت الفحوصات قليلة يكبر خط جدول النتائج وتتسع أسطره فينزل الجدول إلى أسفل الورقة بدل أن يبقى صغيراً في أعلاها. كلما قلّت الفحوصات زاد التوسيع."
                />
              </SettingCard>

              <SettingCard title="رمز QR أسفل التقرير" icon={<QrCodeIcon />} desc="يقرؤه أي هاتف بالكاميرا مباشرة، دون تطبيق." testid="qr-card">
                <Toggle
                  checked={s.labQr !== false}
                  onChange={(v) => setOption({ labQr: v })}
                  label="طباعة رمز المختبر بجانب التوقيع"
                  desc="رمز واحد يحمل اسم المختبر ورقم الهاتف والعنوان والرابط (من «المختبر ← معلومات التواصل») كأسطر بسيطة، والرابط يُفتح بالضغط عليه."
                />
                {s.labQr !== false && (
                  <SubOptions>
                    {!labQrCode(s) && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">أضف رقم الهاتف أو العنوان أو الرابط في «المختبر ← معلومات التواصل» ليظهر الرمز.</p>}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-sm font-medium">العبارة الرئيسية بجانب الرمز
                        <input {...text("labQrTitle")} placeholder={QR_TITLE_DEFAULT} className={`mt-1 ${inp}`} />
                      </label>
                      <label className="text-sm font-medium">العبارة الصغيرة تحتها
                        <input {...text("labQrHint")} placeholder={QR_HINT_DEFAULT} className={`mt-1 ${inp}`} />
                      </label>
                    </div>
                    <Toggle
                      checked={s.labQrLogo !== false}
                      onChange={(v) => setOption({ labQrLogo: v })}
                      label="شعار المختبر وسط الرمز"
                      desc="يبقى الرمز مقروءاً لأنه يُصنع بدرجة تصحيح أخطاء عالية."
                    />
                  </SubOptions>
                )}
              </SettingCard>

              <SettingCard title="التوقيع والختم على التقرير" icon={<PenLine />} testid="signature-card">
                <Toggle
                  checked={s.signatureOn === true}
                  onChange={(v) => setOption({ signatureOn: v })}
                  label="إظهار التوقيع والختم أسفل التقرير"
                  desc="صورة توقيع المحلل واسمه، وختم المختبر، مكان سطر «التوقيع / الختم». الصور من صور المشروع فتظهر نفسها على كل الأجهزة."
                />
                {s.signatureOn === true && (
                  <SubOptions grid>
                    {STATIC_IMAGES.length === 0 && (
                      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:col-span-2">
                        لا صور في المشروع بعد — ضع صورة التوقيع وصورة الختم في المجلد <span dir="ltr" className="font-mono">public/lab-images</span> ثم انشر التحديث لتظهر هنا.
                      </p>
                    )}
                    <ImageChoice label="صورة التوقيع" value={s.signatureImage} onChange={(v) => setOption({ signatureImage: v })} />
                    <ImageChoice label="صورة الختم" value={s.stampImage} onChange={(v) => setOption({ stampImage: v })} />
                    <label className="text-sm font-medium">الاسم تحت التوقيع
                      <input {...text("signatureName")} placeholder="مثلاً: د. أحمد علي" className={`mt-1 ${inp}`} />
                    </label>
                    <label className="text-sm font-medium">الصفة (اختياري)
                      <input {...text("signatureTitle")} placeholder="مثلاً: أخصائي تحليلات مرضية" className={`mt-1 ${inp}`} />
                    </label>
                  </SubOptions>
                )}
              </SettingCard>

              <SettingCard title="الورق والشعار والخط" icon={<ImageIcon />} desc="كلها موقوفة في البداية؛ يبقى التقرير على شكله حتى تشغّل أحدها." testid="report-extras">
                <Toggle
                  checked={s.prePrinted === true}
                  onChange={(v) => setOption({ prePrinted: v })}
                  label="الطباعة على ورق المختبر المطبوع مسبقاً"
                  desc="لا يُطبع رأس التقرير (الشعار والاسم) ولا شريط التذييل ولا العلامة المائية، وتُترك مساحة فارغة أعلى الصفحة وأسفلها لرأس ورقك وتذييله."
                />
                {s.prePrinted === true && (
                  <SubOptions grid>
                    <label className="text-xs text-muted">المساحة الفارغة أعلى الصفحة (مم)
                      <input type="number" min={0} max={120} value={s.prePrintedTop ?? PRE_TOP_DEFAULT} aria-label="المساحة أعلى الصفحة"
                        onChange={(e) => setOption({ prePrintedTop: Math.max(0, Math.min(120, Number(e.target.value) || 0)) })} className={`mt-1 ${inp}`} dir="ltr" />
                    </label>
                    <label className="text-xs text-muted">المساحة الفارغة أسفل الصفحة (مم)
                      <input type="number" min={0} max={120} value={s.prePrintedBottom ?? PRE_BOTTOM_DEFAULT} aria-label="المساحة أسفل الصفحة"
                        onChange={(e) => setOption({ prePrintedBottom: Math.max(0, Math.min(120, Number(e.target.value) || 0)) })} className={`mt-1 ${inp}`} dir="ltr" />
                    </label>
                    <p className="text-[11px] text-muted sm:col-span-2">قِس ارتفاع رأس ورقك وتذييله بالمسطرة وأضف 5 مم احتياطاً، ثم اطبع صفحة تجريبية على ورقة عادية وضعها فوق الورق المطبوع للمقارنة.</p>
                  </SubOptions>
                )}

                <Toggle
                  checked={s.reportHeadOn === true}
                  onChange={(v) => setOption({ reportHeadOn: v })}
                  label="مكان الشعار والعلامة المائية"
                  desc="الشعار بجانب الاسم أو في الجهة الأخرى أو في الوسط فوق الاسم، وحجمه، وإظهار العلامة المائية وحجمها وشفافيتها."
                />
                {s.reportHeadOn === true && (() => {
                  const h = { ...ORIGINAL_HEAD, ...(s.reportHead ?? {}) };
                  const setHead = (patch: Partial<ReportHead>) => setOption({ reportHead: { ...h, ...patch } });
                  const sel = (label: string, value: string, options: [string, string][], on: (v: string) => void) => (
                    <label className="text-xs text-muted">{label}
                      <select value={value} onChange={(e) => on(e.target.value)} className={`mt-1 ${inp}`} aria-label={label}>
                        {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                      </select>
                    </label>
                  );
                  return (
                    <SubOptions grid>
                      {sel("مكان الشعار", h.logo, [["start", "بجانب الاسم (الأصلي)"], ["end", "في الجهة الأخرى من الصفحة"], ["center", "في الوسط فوق الاسم"]], (v) => setHead({ logo: v as ReportHead["logo"] }))}
                      {sel("حجم الشعار", h.logoSize, [["small", "صغير"], ["medium", "متوسط (الأصلي)"], ["large", "كبير"]], (v) => setHead({ logoSize: v as ReportHead["logoSize"] }))}
                      {sel("العلامة المائية", h.watermark ? "on" : "off", [["on", "ظاهرة (الأصلي)"], ["off", "مخفية"]], (v) => setHead({ watermark: v === "on" }))}
                      {h.watermark && sel("حجم العلامة المائية", h.wmSize, [["small", "صغيرة"], ["medium", "متوسطة (الأصلي)"], ["large", "كبيرة"]], (v) => setHead({ wmSize: v as ReportHead["wmSize"] }))}
                      {h.watermark && (
                        <label className="text-xs text-muted sm:col-span-2">
                          <span className="flex items-center justify-between">وضوح العلامة المائية <b className="tabular-nums text-ink" dir="ltr">{h.wmOpacity}%</b></span>
                          <input type="range" min={2} max={20} step={1} value={h.wmOpacity} onChange={(e) => setHead({ wmOpacity: Number(e.target.value) })}
                            className="mt-2 w-full accent-[var(--color-brand)]" aria-label="وضوح العلامة المائية" />
                          <span className="flex justify-between text-[10px]"><span>أخف</span><span>أوضح</span></span>
                          <span className="mt-0.5 block text-[10px]">6% = الأصلي</span>
                        </label>
                      )}
                    </SubOptions>
                  );
                })()}

                <Toggle
                  checked={s.reportFontOn === true}
                  onChange={(v) => setOption({ reportFontOn: v })}
                  label="خط التقرير"
                  desc="خط آخر لورقة النتائج كلها. الخطوط مضمّنة في التطبيق فتعمل بلا إنترنت."
                />
                {s.reportFontOn === true && (
                  <SubOptions grid>
                    {REPORT_FONTS.map((f) => {
                      const on = (s.reportFont ?? "plex") === f.id;
                      return (
                        <button key={f.id} type="button" onClick={() => setOption({ reportFont: f.id })} aria-pressed={on} aria-label={f.name}
                          className={`rounded-lg border px-3 py-2 text-start ${on ? "border-brand bg-canvas" : "border-line hover:bg-canvas"}`}>
                          <span className="block text-[11px] text-muted">{f.name}</span>
                          <span className="block text-base" style={{ fontFamily: f.family }}>مختبر التحليلات المرضية 123</span>
                          <span className="block text-sm" style={{ fontFamily: f.family }} dir="ltr">Hemoglobin 13.5 g/dL</span>
                        </button>
                      );
                    })}
                  </SubOptions>
                )}
              </SettingCard>
            </>
          ),
        },
        {
          id: "forms", label: "الاستمارات", hint: "الإدرار، الخروج، السائل المنوي، الزرع", icon: <ClipboardList />, badge: formsOn,
          content: (
            <>
              <SettingCard title="طباعة الاستمارات" icon={<FileText />} testid="forms-print">
                <Toggle
                  checked={s.formBoldAbnormal !== false}
                  onChange={(v) => setOption({ formBoldAbnormal: v })}
                  label="تمييز النتيجة غير الطبيعية بخط عريض"
                  desc="تُطبع النتيجة المخالفة للقيمة الطبيعية أو للمعدل المطبوع بجانبها بخط عريض، بلا ألوان."
                />
                <Toggle
                  checked={s.formHideEmpty === true}
                  onChange={(v) => setOption({ formHideEmpty: v })}
                  label="إخفاء الحقول الفارغة عند الطباعة"
                  desc="الحقل الذي لم يُملأ لا يُطبع صفه، وكذلك العنوان الفرعي أو القسم الذي لم يُملأ منه شيء."
                />
                <Toggle
                  checked={s.csTestedOnly === true}
                  onChange={(v) => setOption({ csTestedOnly: v })}
                  label="الزرع: طباعة المضادات المفحوصة فقط"
                  desc="عند الإيقاف (الافتراضي) تُطبع قائمة المضادات كاملة كما في الورقة، والمضاد غير المفحوص يبقى فارغاً."
                />
              </SettingCard>
              <SettingCard title="السائل المنوي" icon={<Calculator />} testid="forms-sfa">
                <Toggle
                  checked={s.sfaDiagnosis !== false}
                  onChange={(v) => setOption({ sfaDiagnosis: v })}
                  label="الخلاصة التلقائية (Conclusion)"
                  desc="تُحسب من القيم حسب المعدلات المطبوعة: Normozoospermia، Oligo/Astheno/Teratozoospermia، Azoospermia، مع Hypospermia وNecrozoospermia. تُطبع أسفل التقرير ويمكن استبدالها."
                />
                <Toggle
                  checked={s.sfaAutoCalc !== false}
                  onChange={(v) => setOption({ sfaAutoCalc: v })}
                  label="الحساب التلقائي"
                  desc="عند إدخال PR وNP يُحسب Total Motility وImmotile، وعند إدخال Normal تُحسب Abnormal (والعكس)، ومن التركيز والحجم يُحسب Total Sperm Count."
                />
              </SettingCard>
              <SettingCard title="محرر الاستمارات" icon={<Pencil />}>
                <Toggle
                  checked={s.formExtraNormals === true}
                  onChange={(v) => setOption({ formExtraNormals: v })}
                  label="قيم طبيعية إضافية"
                  desc="في «إدارة الفحوصات ← الاستمارة» يظهر لكل حقل «قيم أخرى تُعتبر طبيعية» وخيار «حقل وصفي»، لتحديد ما لا يُطبع بخط عريض."
                />
              </SettingCard>
            </>
          ),
        },
        {
          id: "entry", label: "شاشة الإدخال", hint: "ما يظهر للفاحص أثناء إدخال النتائج", icon: <ListCollapse />, badge: entryOn,
          content: (
            <>
              <SettingCard title="الأزرار تحت النتائج" icon={<Printer />} testid="entry-buttons">
                <Toggle
                  checked={s.entryPrintButton !== false}
                  onChange={(v) => setOption({ entryPrintButton: v })}
                  label="زر طباعة تحت إدخال النتائج"
                  desc="زر «طباعة» عريض أسفل مربع إدخال النتائج، إضافةً لزر الطباعة في أعلى الصفحة."
                />
                <Toggle
                  checked={s.entryWhatsApp !== false}
                  onChange={(v) => setOption({ entryWhatsApp: v })}
                  label="زر مشاركة واتساب بجانب زر الطباعة"
                  desc="يحفظ الزيارة ويفتح واتساب مباشرة على رقم المريض (أو واتساب لاختيار المريض إن لم يكن له رقم)، ويحفظ التقرير ملف PDF لإرفاقه في المحادثة."
                />
              </SettingCard>

              <SettingCard title="أثناء إدخال النتائج" icon={<ListCollapse />} testid="entry-options">
                <Toggle
                  checked={s.entryHighlight !== false}
                  onChange={(v) => setOption({ entryHighlight: v })}
                  label="مربع «تمييز» بجانب كل نتيجة"
                  desc="علامة صح تلوّن النتيجة بلون التظليل (هاي لايت) على التقرير المطبوع — بجانب كل فحص، وبجانب كل حقل في استمارات الإدرار والخروج والسائل المنوي والزرع."
                />
                <Toggle
                  checked={s.showPrevious !== false}
                  onChange={(v) => setOption({ showPrevious: v })}
                  label="إظهار النتيجة السابقة للفاحص"
                  desc="تظهر تحت حقل النتيجة في شاشة الإدخال فقط، ولا تُطبع (طباعتها من «التقرير المطبوع»)."
                />
                <Toggle
                  checked={s.autoDerived === true}
                  onChange={(v) => setOption({ autoDerived: v })}
                  label="الحساب التلقائي للفحوصات المشتقة"
                  desc="عند اختيار الفحص المشتق مع فحوصاته تُحسب النتيجة تلقائياً ويمكن تعديلها يدوياً: البيليروبين غير المباشر، الغلوبيولين، VLDL، LDL (Friedewald)، BUN، HOMA-IR."
                />
                {s.autoDerived === true && (
                  <SubOptions>
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
                  </SubOptions>
                )}
                <Toggle
                  checked={s.collapseGroups === true}
                  onChange={(v) => setOption({ collapseGroups: v })}
                  label="طيّ مجموعات الفحوصات"
                  desc="تُطوى كل مجموعة تحت عنوانها وتُفتح بالضغط عليه، والبحث يفتحها تلقائياً."
                />
                <Toggle
                  checked={s.ageUnit === true}
                  onChange={(v) => setOption({ ageUnit: v })}
                  label="وحدة العمر (سنة / شهر / يوم)"
                  desc="قائمة بجانب حقل العمر بدل كتابة «6 أشهر» — مفيدة للأطفال ومعدلاتهم حسب العمر. السنوات تُحفظ رقماً كما هي."
                />
              </SettingCard>

              <SettingCard title="ملصق الأنبوب" icon={<Tag />}>
                <Toggle
                  checked={s.tubeLabel === true}
                  onChange={(v) => setOption({ tubeLabel: v })}
                  label="طباعة ملصق الأنبوب"
                  desc="يُظهر زر «ملصق الأنبوب» في شاشة الإدخال: اسم المريض، رقم العينة كباركود، والتاريخ — للصقه على أنبوب العينة."
                />
                {s.tubeLabel === true && (
                  <SubOptions grid>
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
                  </SubOptions>
                )}
              </SettingCard>

              <SettingCard title="الزيارات المحفوظة" icon={<History />}>
                <Toggle
                  checked={s.deliveryStatus === true}
                  onChange={(v) => setOption({ deliveryStatus: v })}
                  label="حالة تسليم النتائج"
                  desc="في «الزيارات المحفوظة» عمود «التسليم» (لم تُسلَّم / سُلِّمت مع التاريخ)، وفلتر للزيارات غير المسلّمة، وتسليم عدة زيارات دفعة واحدة."
                />
              </SettingCard>
            </>
          ),
        },
        {
          id: "stock", label: "المخزن", hint: "عند نفاد المادة", icon: <Boxes />,
          content: <StockOptionsCard from="station" />,
        },
        {
          id: "tests", label: "الفحوصات والأطباء", hint: "الأطباء المحيلون وقائمة الفحوصات", icon: <Stethoscope />, badge: doctors.length ? `${doctors.length} طبيب` : null,
          content: (
            <>
              <SettingCard title="الأطباء المُحيلون" icon={<Stethoscope />} desc="تظهر هذه القائمة في «مصدر التحويل» بشاشة الإدخال إلى جانب «مريض خارجي».">
                <div className="flex flex-wrap items-end gap-2">
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
                          <button onClick={() => editDoctor(d)} aria-label="تعديل" className="grid size-7 place-items-center rounded-lg border border-line hover:bg-canvas"><Pencil className="size-4" /></button>
                          <button onClick={() => delDoctor(d.id)} aria-label="حذف" className="grid size-7 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SettingCard>

              <SettingCard title="استعادة الافتراض لقائمة الفحوصات" icon={<RotateCcw />} testid="defaults-card"
                desc="الزيارات المحفوظة لا تتأثر. الفحوصات المدمجة تحتفظ بمعرّفاتها فتبقى النتائج السابقة مرتبطة بها.">
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => {
                    if (!window.confirm("إرجاع أسماء ووحدات ومعدلات الفحوصات المدمجة إلى قيمها الافتراضية، وإعادة المحذوف منها؟ فحوصاتك المضافة تبقى كما هي.")) return;
                    setDefaultsMsg(`أُعيدت ${resetBuiltinTests()} فحصاً مدمجاً إلى القيم الافتراضية.`);
                  }} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
                    <RotateCcw className="size-4" /> استعادة القيم الافتراضية للفحوصات
                  </button>
                  <button onClick={() => {
                    if (!window.confirm("استبدال قائمة الفحوصات كلها بالقائمة الافتراضية؟ تُحذف الفحوصات التي أضفتها بنفسك وتُعاد كل الفحوصات المدمجة إلى قيمها الافتراضية.")) return;
                    setDefaultsMsg(`أُعيدت القائمة الافتراضية (${restoreDefaultTests()} فحصاً).`);
                  }} className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50">
                    استعادة قائمة الفحوصات الافتراضية بالكامل
                  </button>
                </div>
                {defaultsMsg && <p className="text-xs text-brand-dark" role="status">{defaultsMsg}</p>}
              </SettingCard>
            </>
          ),
        },
        {
          id: "device", label: "الجهاز والبيانات", hint: "النسخ الاحتياطي والتخزين والمزامنة والتثبيت", icon: <Smartphone />, badge: overdue ? "نسخة متأخرة" : null,
          content: (
            <>
              <SettingCard title="النسخ الاحتياطي والتخزين" icon={<HardDrive />} tone={overdue ? "warn" : undefined}
                desc="كل البيانات محفوظة على هذا الحاسوب فقط. صدّر نسخة احتياطية بانتظام، أو انقلها إلى حاسوب آخر.">
                {overdue && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                    لم تأخذ نسخة احتياطية مؤخراً وبياناتك محفوظة على هذا الجهاز فقط — صدّر نسخة الآن.
                  </div>
                )}
                {usage && (
                  <div data-testid="storage-usage">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted">
                      <span>المساحة المستخدمة: <b className="tabular-nums">{usage.pct < 1 ? "أقل من 1%" : `${usage.pct}%`}</b> — {usage.visits} زيارة</span>
                      <span className="tabular-nums" dir="ltr">{mb(usage.used)} / {mb(usage.quota)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-canvas">
                      <div className={`h-full rounded-full ${usage.pct >= 80 ? "bg-red-500" : usage.pct >= 60 ? "bg-amber-500" : "bg-brand"}`} style={{ width: `${Math.max(2, usage.pct)}%` }} />
                    </div>
                    {!usage.large && <p className="mt-1 text-xs text-muted">هذا المتصفح يحفظ في المخزن الصغير (نحو 5 MB) — افتح المحطة في نافذة عادية لا خاصة.</p>}
                    {usage.pct >= 80 && (
                      <p className="mt-1 text-xs font-medium text-red-600">اقتربت المساحة من الحد — صدّر نسخة واحذف زيارات قديمة.</p>
                    )}
                  </div>
                )}
                {persisted !== null && (
                  <div className={`rounded-lg px-3 py-2 text-xs ${persisted ? "bg-brand-light text-brand-dark" : "bg-amber-50 text-amber-800"}`}>
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
                <div>
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
              </SettingCard>

              <SettingCard title="حرف هذا الجهاز في رقم العينة" icon={<Hash />} testid="device-tag"
                desc="اختياري، لمختبر فيه أكثر من جهاز: لكل جهاز حرفه فلا يتكرر رقم العينة حتى لو عملت الأجهزة بدون إنترنت في الوقت نفسه. يبقى على هذا الجهاز فقط.">
                <div className="flex flex-wrap items-center gap-2">
                  <input value={tag} onChange={(e) => { const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2); setTag(v); setDeviceTag(v); notifySaved(); }}
                    dir="ltr" aria-label="حرف الجهاز" placeholder="A" className="w-20 rounded-lg border border-line bg-surface px-3 py-2 text-center font-mono text-sm uppercase outline-none focus:border-brand" />
                  <span className="text-xs text-muted">مثال: <span dir="ltr" className="font-mono">LAB-{new Date().toLocaleDateString("en-CA").replace(/-/g, "")}-{tag}001</span></span>
                </div>
              </SettingCard>

              <SyncPanel />

              <SettingCard title="تثبيت كتطبيق" icon={<Smartphone />} desc="ثبّت محطة المختبر كتطبيق مستقلّ يفتح مباشرةً على شاشة الإدخال ويعمل بدون إنترنت.">
                <div>
                  <InstallButton />
                  <div className="mt-2"><OfflineStatusLine /></div>
                </div>
              </SettingCard>
            </>
          ),
        },
        {
          id: "look", label: "الأمان والمظهر", hint: "رمز الدخول والألوان", icon: <ShieldCheck />,
          content: (
            <>
              <PinCard station="station" />
              <ThemeCard storageKey={THEME_KEYS.station} />
            </>
          ),
        },
      ]}
    />
  );
}

/** Pick one of the project's images (public/lab-images), with a preview. */
function ImageChoice({ label, value, onChange }: { label: string; value?: string; onChange: (v: string | undefined) => void }) {
  return (
    <label className="text-sm font-medium">{label}
      <div className="mt-1 flex items-center gap-2">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={encodeURI(value)} alt="" className="size-12 shrink-0 rounded-lg border border-line bg-white object-contain" />
        ) : <span className="grid size-12 shrink-0 place-items-center rounded-lg border border-dashed border-line text-muted"><ImageIcon className="size-4" /></span>}
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)} aria-label={label} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand">
          <option value="">— بدون —</option>
          {STATIC_IMAGES.map((m) => <option key={m.path} value={m.path}>{m.caption}</option>)}
        </select>
      </div>
    </label>
  );
}

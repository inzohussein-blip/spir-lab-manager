/**
 * Where a lab's database can live, with the steps to get its connection string, and advice on a
 * string before it is saved (shared by /licenses and the admin panel's Settings; no server APIs).
 */

export type ProviderId = "neon" | "supabase" | "railway" | "postgres";

export interface Provider {
  id: ProviderId;
  name: string;
  /** One line under the name. */
  tagline: string;
  /** Where the owner goes to create the database. */
  site: string;
  siteLabel: string;
  steps: string[];
  placeholder: string;
}

export const PROVIDERS: Provider[] = [
  {
    id: "neon",
    name: "Neon",
    tagline: "PostgreSQL سحابي بخطة مجانية — الأنسب مع Vercel",
    site: "https://console.neon.tech",
    siteLabel: "console.neon.tech",
    steps: [
      "ادخل إلى console.neon.tech وأنشئ مشروعاً جديداً (Create project) باسم المختبر، واختر أقرب منطقة (Region).",
      "من لوحة المشروع اضغط Connect.",
      "فعّل Connection pooling (يظهر ‎-pooler‎ في العنوان).",
      "انسخ الرابط الكامل الذي يبدأ بـ postgresql://‎ (فيه اسم المستخدم وكلمة المرور) والصقه هنا.",
    ],
    placeholder: "postgresql://user:password@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require",
  },
  {
    id: "supabase",
    name: "Supabase",
    tagline: "PostgreSQL مع لوحة إدارة — استخدم رابط Transaction pooler",
    site: "https://supabase.com/dashboard",
    siteLabel: "supabase.com/dashboard",
    steps: [
      "ادخل إلى supabase.com/dashboard وأنشئ مشروعاً جديداً (New project) للمختبر، واحفظ كلمة مرور قاعدة البيانات التي تكتبها.",
      "اضغط Connect أعلى صفحة المشروع.",
      "اختر Transaction pooler (المنفذ 6543) — الاتصال المباشر db.xxxx.supabase.co لا يعمل غالباً من Vercel.",
      "انسخ الرابط، وضع كلمة مرور القاعدة مكان [YOUR-PASSWORD]، ثم الصقه هنا.",
    ],
    placeholder: "postgresql://postgres.xxxx:password@aws-0-region.pooler.supabase.com:6543/postgres",
  },
  {
    id: "railway",
    name: "Railway",
    tagline: "خادم PostgreSQL بسيط مدفوع حسب الاستخدام",
    site: "https://railway.com/dashboard",
    siteLabel: "railway.com",
    steps: [
      "ادخل إلى railway.com وأنشئ مشروعاً جديداً (New Project) ثم اختر Database ← PostgreSQL.",
      "افتح خدمة Postgres ← Variables.",
      "انسخ قيمة DATABASE_PUBLIC_URL (العنوان العام ‎…proxy.rlwy.net‎) — وليس DATABASE_URL الداخلي.",
      "الصقه هنا.",
    ],
    placeholder: "postgresql://postgres:password@xxxx.proxy.rlwy.net:12345/railway",
  },
  {
    id: "postgres",
    name: "PostgreSQL آخر",
    tagline: "خادمك الخاص أو أي مزوّد آخر",
    site: "",
    siteLabel: "",
    steps: [
      "أنشئ قاعدة بيانات فارغة للمختبر ومستخدماً له صلاحية إنشاء الجداول.",
      "تأكّد أن الخادم يقبل الاتصال من الإنترنت (العناوين الداخلية مرفوضة).",
      "الصق رابط الاتصال، أو املأ الحقول ليُكتب الرابط تلقائياً.",
      "لخادم بشهادة TLS ذاتية اختر «بدون تحقق من الشهادة».",
    ],
    placeholder: "postgresql://user:password@host:5432/dbname",
  },
];

export const providerById = (id: string | undefined): Provider =>
  PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[PROVIDERS.length - 1];

/** Which provider a connection string (or host) belongs to. */
export function providerOf(connOrHost: string): ProviderId {
  let host = connOrHost.trim().toLowerCase();
  try { host = new URL(connOrHost).hostname.toLowerCase(); } catch { /* a host already */ }
  if (/(^|\.)neon\.tech(:|\/|$)/.test(host)) return "neon";
  if (/(^|\.)supabase\.(co|com)(:|\/|$)/.test(host)) return "supabase";
  if (/(^|\.)(rlwy\.net|railway\.app|railway\.internal)(:|\/|$)/.test(host)) return "railway";
  return "postgres";
}

export interface Advice { level: "error" | "warn" | "ok"; text: string }

/** What to tell the owner about a connection string before it is tried. */
export function connAdvice(conn: string, chosen?: ProviderId): Advice[] {
  const s = conn.trim();
  if (!s) return [];
  let u: URL;
  try { u = new URL(s); } catch { return [{ level: "error", text: "الرابط غير صحيح — يبدأ بـ postgresql://‎" }]; }
  if (!/^postgres(ql)?:$/.test(u.protocol)) return [{ level: "error", text: "الرابط غير صحيح — يبدأ بـ postgresql://‎" }];
  const out: Advice[] = [];
  const host = u.hostname.toLowerCase();
  const p = providerOf(s);
  if (chosen && chosen !== "postgres" && p !== chosen) {
    out.push({ level: "warn", text: `هذا الرابط ليس من ${providerById(chosen).name}${p !== "postgres" ? ` بل من ${providerById(p).name}` : ""} — تأكّد أنك نسخت الرابط الصحيح.` });
  }
  if (!u.password) out.push({ level: "error", text: "الرابط بلا كلمة مرور — انسخ الرابط الكامل (أو ضع كلمة المرور مكان [YOUR-PASSWORD])." });
  if (/\[?your-password\]?/i.test(decodeURIComponent(u.password))) out.push({ level: "error", text: "ضع كلمة مرور القاعدة مكان [YOUR-PASSWORD]." });
  if (p === "neon" && !host.includes("-pooler")) {
    out.push({ level: "warn", text: "هذا رابط Neon المباشر — فعّل Connection pooling وانسخ الرابط الذي فيه ‎-pooler‎ حتى لا تنفد الاتصالات مع كثرة المستخدمين." });
  }
  if (p === "supabase" && /^db\.[a-z0-9]+\.supabase\.co$/.test(host)) {
    out.push({ level: "warn", text: "هذا اتصال Supabase المباشر (IPv6 فقط) ولا يصل إليه Vercel غالباً — اختر Transaction pooler (‎pooler.supabase.com‎، المنفذ 6543)." });
  } else if (p === "supabase" && host.endsWith("pooler.supabase.com") && u.port !== "6543") {
    out.push({ level: "warn", text: "هذا Session pooler — يُفضَّل Transaction pooler (المنفذ 6543) مع Vercel." });
  }
  if (p === "railway" && host.endsWith("railway.internal")) {
    out.push({ level: "error", text: "هذا عنوان Railway الداخلي — انسخ DATABASE_PUBLIC_URL (‎…proxy.rlwy.net‎)." });
  }
  if (!out.length) out.push({ level: "ok", text: p === "postgres" ? "الرابط مكتمل — اختبر الاتصال." : `رابط ${providerById(p).name} مناسب — اختبر الاتصال.` });
  return out;
}

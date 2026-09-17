"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  UserRound,
  Stethoscope,
  Search,
  FlaskConical,
  Printer,
  Send,
  Check,
} from "lucide-react";
import { useOffline } from "@/components/offline/OfflineProvider";
import { Card, Button, Badge } from "@/components/ui/primitives";
import { money } from "@/lib/utils";
import type { OutboxFields } from "@/lib/offline/outbox";

type Test = {
  id: string;
  name_ar: string;
  name_en: string | null;
  category: string | null;
  price: number;
};
type Referrer = { id: string; name: string; clinic: string | null };
type Patient = {
  id: string;
  full_name: string;
  gender: string | null;
  age_years: number | null;
  birth_date: string | null;
  phone: string | null;
  is_pregnant: boolean;
};

const PAY_STATUS: { value: string; label: string }[] = [
  { value: "unpaid", label: "غير مدفوع" },
  { value: "paid", label: "مدفوع" },
  { value: "partial", label: "دفع جزئي" },
];
const PAY_METHOD: { value: string; label: string }[] = [
  { value: "cash", label: "نقداً" },
  { value: "card", label: "بطاقة" },
  { value: "transfer", label: "تحويل" },
];

const genderLabel = (g: string | null) =>
  g === "male" ? "ذكر" : g === "female" ? "أنثى" : "—";

export function OrderForm({
  patient,
  tests,
  referrers,
}: {
  patient: Patient;
  tests: Test[];
  referrers: Referrer[];
}) {
  const { submitOrder } = useOffline();
  const router = useRouter();
  const [pending, start] = useTransition();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [source, setSource] = useState<"complex" | "external">("external");
  const [referrer, setReferrer] = useState("");
  const [payStatus, setPayStatus] = useState("unpaid");
  const [payMethod, setPayMethod] = useState("cash");
  const [q, setQ] = useState("");

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  // Group tests by category, filtered by the search box.
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const match = (t: Test) =>
      !term ||
      t.name_ar.toLowerCase().includes(term) ||
      (t.name_en ?? "").toLowerCase().includes(term);
    const map = new Map<string, Test[]>();
    for (const t of tests) {
      if (!match(t)) continue;
      const key = t.category?.trim() || "فحوصات أخرى";
      (map.get(key) ?? map.set(key, []).get(key)!).push(t);
    }
    return Array.from(map.entries());
  }, [tests, q]);

  const total = tests
    .filter((t) => selected.has(t.id))
    .reduce((s, t) => s + Number(t.price), 0);

  function build(): OutboxFields {
    return {
      patient_id: patient.id,
      referrer_id: source === "complex" ? referrer : "",
      test_ids: Array.from(selected),
      payment_status: payStatus,
      payment_method: payMethod,
    };
  }

  function submit(after: "lab" | "receipt") {
    if (selected.size === 0) {
      toast.error("اختر فحصاً واحداً على الأقل");
      return;
    }
    if (source === "complex" && !referrer) {
      toast.error("اختر الطبيب المُحيل من المجمع");
      return;
    }
    start(async () => {
      const r = await submitOrder(build(), `طلب فحص (${selected.size})`);
      if (r.status === "synced") {
        toast.success("تم إنشاء الطلب");
        router.push(after === "receipt" ? `/orders/${r.orderId}/receipt` : `/orders/${r.orderId}`);
      } else {
        toast.info("حُفظ الطلب محلياً — سيُزامن عند عودة الاتصال");
        router.push(`/patients/${patient.id}`);
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      {/* ── Left column: patient + referral + tests ─────────────────────────── */}
      <div className="flex flex-col gap-4">
        {/* Patient summary (already registered) */}
        <Card className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-brand-light text-brand-dark">
              <UserRound className="size-5" />
            </span>
            <div>
              <div className="font-bold">{patient.full_name}</div>
              <div className="text-xs text-muted">
                {genderLabel(patient.gender)}
                {patient.age_years ? ` · ${patient.age_years} سنة` : ""}
                {patient.phone ? ` · ${patient.phone}` : ""}
              </div>
            </div>
          </div>
          {patient.is_pregnant && <Badge tone="warn">حامل</Badge>}
        </Card>

        {/* Referral source */}
        <Card>
          <SectionTitle icon={<Stethoscope className="size-4" />} n={1}>
            مصدر التحويل
          </SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            <SourceOption
              active={source === "complex"}
              onClick={() => setSource("complex")}
              title="طبيب من المجمع"
              hint="محوّل من إحدى عيادات المجمع"
            />
            <SourceOption
              active={source === "external"}
              onClick={() => setSource("external")}
              title="مريض خارجي"
              hint="بدون تحويل من طبيب"
            />
          </div>
          {source === "complex" && (
            <select
              value={referrer}
              onChange={(e) => setReferrer(e.target.value)}
              className="mt-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="">— اختر الطبيب المُحيل —</option>
              {referrers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.clinic ? ` (${r.clinic})` : ""}
                </option>
              ))}
            </select>
          )}
        </Card>

        {/* Test selection */}
        <Card>
          <SectionTitle icon={<FlaskConical className="size-4" />} n={2}>
            اختيار الفحوصات
          </SectionTitle>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث عن فحص…"
              className="w-full rounded-lg border border-line bg-surface py-2 pr-9 pl-3 text-sm outline-none focus:border-brand"
            />
          </div>

          <div className="flex flex-col gap-4">
            {groups.length === 0 && (
              <p className="py-6 text-center text-sm text-muted">لا فحوصات مطابقة</p>
            )}
            {groups.map(([cat, items]) => (
              <div key={cat}>
                <div className="mb-1.5 text-xs font-semibold text-muted">{cat}</div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {items.map((t) => {
                    const on = selected.has(t.id);
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => toggle(t.id)}
                        className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-right text-sm transition-colors ${
                          on
                            ? "border-brand bg-brand-light/60"
                            : "border-line hover:bg-canvas"
                        }`}
                      >
                        <span
                          className={`grid size-4 shrink-0 place-items-center rounded border ${
                            on ? "border-brand bg-brand text-white" : "border-line"
                          }`}
                        >
                          {on && <Check className="size-3" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{t.name_ar}</span>
                        <span className="shrink-0 text-xs text-muted tabular-nums">
                          {money(t.price)} ر.س
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Right column: finance summary (sticky) ──────────────────────────── */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <Card className="flex flex-col gap-4">
          <div className="text-sm font-semibold">الملخّص المالي</div>

          <div className="rounded-xl bg-canvas p-4 text-center">
            <div className="text-xs text-muted">المبلغ الإجمالي</div>
            <div className="mt-1 text-3xl font-bold tabular-nums text-brand-dark">
              {money(total)} <span className="text-lg">ر.س</span>
            </div>
            <div className="mt-1 text-xs text-muted">
              {selected.size} فحص محدَّد
            </div>
          </div>

          <label className="text-sm font-medium">
            حالة الدفع
            <select
              value={payStatus}
              onChange={(e) => setPayStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
            >
              {PAY_STATUS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>

          {payStatus !== "unpaid" && (
            <label className="text-sm font-medium">
              طريقة الدفع
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
              >
                {PAY_METHOD.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </label>
          )}

          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <Button
              onClick={() => submit("lab")}
              disabled={pending || selected.size === 0}
              className="justify-center"
            >
              <Send className="size-4" /> {pending ? "جارٍ الإنشاء…" : "إرسال الطلب للمختبر"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => submit("receipt")}
              disabled={pending || selected.size === 0}
              className="justify-center"
            >
              <Printer className="size-4" /> حفظ وطباعة الوصل
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SectionTitle({
  n,
  icon,
  children,
}: {
  n: number;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="grid size-6 place-items-center rounded-full bg-brand-light text-xs font-bold text-brand-dark">
        {n}
      </span>
      <span className="flex items-center gap-1.5 text-sm font-semibold">
        {icon} {children}
      </span>
    </div>
  );
}

function SourceOption({
  active,
  onClick,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-right transition-colors ${
        active ? "border-brand bg-brand-light/60" : "border-line hover:bg-canvas"
      }`}
    >
      <span
        className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${
          active ? "border-brand" : "border-line"
        }`}
      >
        {active && <span className="size-2 rounded-full bg-brand" />}
      </span>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </button>
  );
}

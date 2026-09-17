"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRound, Search, Phone, CalendarClock } from "lucide-react";

export type PickPatient = {
  id: string;
  full_name: string;
  gender: string | null;
  age_years: number | null;
  phone: string | null;
  visits: number;
  last_visit: string | null;
};

const genderText = (g: string | null) =>
  g === "male" ? "ذكر" : g === "female" ? "أنثى" : null;

/** Live-searchable patient chooser for starting a new order. Filters the
 *  loaded list client-side (name or phone) so picking is instant. */
export function PatientPicker({ patients }: { patients: PickPatient[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return patients;
    return patients.filter(
      (p) =>
        p.full_name.toLowerCase().includes(term) ||
        (p.phone ?? "").toLowerCase().includes(term)
    );
  }, [patients, q]);

  const go = (id: string) => router.push(`/orders/new?patient=${id}`);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && filtered.length > 0) go(filtered[0].id);
          }}
          placeholder="ابحث بالاسم أو رقم الهاتف…"
          className="w-full rounded-lg border border-line bg-surface py-2.5 pr-10 pl-3 text-sm outline-none focus:border-brand"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">لا يوجد مريض مطابق</p>
      ) : (
        <ul className="flex max-h-[60vh] flex-col overflow-y-auto">
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => go(p.id)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right hover:bg-canvas"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-light text-sm font-bold text-brand-dark">
                  {p.full_name?.trim()?.[0] ?? <UserRound className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.full_name}</span>
                  <span className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
                    {genderText(p.gender) && <span>{genderText(p.gender)}</span>}
                    {p.age_years != null && <span>{p.age_years} سنة</span>}
                    {p.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="size-3" /> {p.phone}
                      </span>
                    )}
                  </span>
                </span>
                <span className="shrink-0 text-left text-xs text-muted">
                  {p.visits > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="size-3" /> {p.last_visit}
                    </span>
                  ) : (
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-brand-dark">جديد</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

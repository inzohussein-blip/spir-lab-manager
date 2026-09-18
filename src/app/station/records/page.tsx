"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, Search, UserRound, Phone, Plus, Trash2, Printer } from "lucide-react";
import {
  getPatients, addPatientNote, deletePatients, getVisits,
  type StationPatient, type StationVisit, type Gender,
} from "@/lib/station/store";

const genderText = (g: Gender) => (g === "male" ? "ذكر" : g === "female" ? "أنثى" : "—");

export default function RecordsPage() {
  const [patients, setPatients] = useState<StationPatient[]>([]);
  const [visits, setVisits] = useState<StationVisit[]>([]);
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => { setPatients(getPatients()); setVisits(getVisits()); }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return patients;
    return patients.filter((p) => p.name.toLowerCase().includes(t) || (p.phone ?? "").includes(t));
  }, [patients, q]);

  const sel = patients.find((p) => p.id === selId) ?? null;

  // Visits belonging to this patient (by id, or legacy match on name+phone).
  const patVisits = useMemo(() => {
    if (!sel) return [];
    const key = `${sel.name.trim().toLowerCase()}|${(sel.phone ?? "").trim()}`;
    return visits
      .filter((v) => v.patientId === sel.id || (!v.patientId && `${v.patient.name.trim().toLowerCase()}|${(v.patient.phone ?? "").trim()}` === key))
      .sort((a, b) => b.created_at - a.created_at);
  }, [visits, sel]);

  function saveNote() {
    if (!sel || !note.trim()) return;
    addPatientNote(sel.id, note);
    setPatients(getPatients());
    setNote("");
  }
  function removePatient(id: string) {
    if (!window.confirm("حذف سجل هذا المراجع؟ (لا يحذف زياراته المطبوعة)")) return;
    deletePatients([id]);
    setPatients(getPatients());
    if (selId === id) setSelId(null);
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Archive className="size-6" /> المحفوظات — سجل المراجعين</h1>
        <p className="mt-1 text-sm text-muted">هستوري كامل لكل مراجع: معلوماته، ملاحظاته، وكل فحوصاته وزياراته السابقة.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Patients list */}
        <div>
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-line bg-surface px-3">
            <Search className="size-4 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو الهاتف…" className="w-full bg-transparent py-2 text-sm outline-none" />
          </div>
          <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
            {filtered.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">لا مراجعين محفوظين بعد</p>}
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelId(p.id)}
                className={`flex w-full items-center gap-2.5 border-b border-line px-3 py-2.5 text-right last:border-0 hover:bg-canvas ${selId === p.id ? "bg-brand-light/40" : ""}`}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-light text-sm font-bold text-brand-dark">
                  {p.name?.trim()?.[0] ?? <UserRound className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="flex items-center gap-2 text-xs text-muted">
                    {genderText(p.gender)}
                    {p.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3" /> {p.phone}</span>}
                  </span>
                </span>
                {p.notes.length > 0 && <span className="rounded-full bg-amber-50 px-1.5 text-xs text-amber-700">{p.notes.length}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div>
          {!sel ? (
            <div className="grid h-full min-h-64 place-items-center rounded-2xl border border-dashed border-line text-sm text-muted">اختر مراجعاً لعرض سجله الكامل</div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
                <div className="flex items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-full bg-brand-light text-lg font-bold text-brand-dark">{sel.name?.trim()?.[0] ?? "؟"}</span>
                  <div>
                    <div className="text-lg font-bold">{sel.name}</div>
                    <div className="text-xs text-muted">{genderText(sel.gender)}{sel.age ? ` · ${sel.age} سنة` : ""}{sel.phone ? ` · ${sel.phone}` : ""}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/station?patient=${sel.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><Plus className="size-4" /> زيارة جديدة</Link>
                  <button onClick={() => removePatient(sel.id)} className="grid size-9 place-items-center rounded-lg border border-line text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button>
                </div>
              </div>

              {/* Notes */}
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
                <div className="mb-3 text-sm font-semibold">الملاحظات</div>
                <div className="flex gap-2">
                  <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveNote()} placeholder="أضف ملاحظة عن الحالة…" className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
                  <button onClick={saveNote} className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><Plus className="size-4" /> إضافة</button>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {sel.notes.length === 0 && <p className="text-sm text-muted">لا ملاحظات بعد.</p>}
                  {sel.notes.map((n, i) => (
                    <div key={i} className="rounded-lg bg-canvas p-3 text-sm">
                      <div className="text-[11px] text-muted">{new Date(n.ts).toLocaleString("ar-IQ")}</div>
                      <div className="mt-0.5">{n.text}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Visit history */}
              <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
                <div className="border-b border-line px-4 py-3 text-sm font-semibold">سجل الزيارات والفحوصات ({patVisits.length})</div>
                {patVisits.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted">لا زيارات محفوظة لهذا المراجع.</p>
                ) : (
                  <div className="flex flex-col divide-y divide-line">
                    {patVisits.map((v) => (
                      <div key={v.id} className="px-4 py-3">
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-medium">
                            {new Date(v.created_at).toLocaleDateString("ar-IQ")}
                            {v.accession && <span className="ms-2 font-mono text-xs text-muted">{v.accession}</span>}
                          </div>
                          <Link href={`/station/visits`} className="inline-flex items-center gap-1 text-xs text-brand-dark hover:underline"><Printer className="size-3.5" /> الزيارات</Link>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {v.results.map((r, i) => (
                            <span key={i} className="rounded-md bg-canvas px-2 py-0.5 text-xs">
                              {r.name_ar}: <b>{r.value || "—"}</b>{r.unit ? ` ${r.unit}` : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Network, ArrowLeftRight } from "lucide-react";
import { getTests, type TrainingTest } from "@/lib/training/store";

const PALETTE = ["#4f46e5", "#0d9488", "#d97706", "#db2777", "#2563eb", "#16a34a", "#9333ea", "#dc2626", "#0891b2", "#65a30d"];
const SIZE = 760, C = SIZE / 2, R = 270;

/** Visual correlation map: tests on a circle (grouped by category), links as curves. */
export default function MapPage() {
  const [tests, setTests] = useState<TrainingTest[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => { setTests(getTests()); }, []);

  const linkedIds = useMemo(() => {
    const s = new Set<string>();
    tests.forEach((t) => t.links.forEach((l) => { if (tests.some((x) => x.id === l.id)) { s.add(t.id); s.add(l.id); } }));
    return s;
  }, [tests]);

  const nodes = useMemo(() => {
    const list = tests
      .filter((t) => showAll || linkedIds.has(t.id))
      .sort((a, b) => (a.category || "أخرى").localeCompare(b.category || "أخرى", "ar") || a.name_ar.localeCompare(b.name_ar, "ar"));
    return list.map((t, i) => {
      const a = (2 * Math.PI * i) / Math.max(1, list.length) - Math.PI / 2;
      return { t, x: C + R * Math.cos(a), y: C + R * Math.sin(a), lx: C + (R + 34) * Math.cos(a), ly: C + (R + 34) * Math.sin(a) };
    });
  }, [tests, showAll, linkedIds]);

  const cats = useMemo(() => Array.from(new Set(nodes.map((n) => n.t.category?.trim() || "أخرى"))), [nodes]);
  const color = (t: TrainingTest) => PALETTE[cats.indexOf(t.category?.trim() || "أخرى") % PALETTE.length];
  const pos = useMemo(() => new Map(nodes.map((n) => [n.t.id, n])), [nodes]);

  // One edge per pair; remember notes from both directions.
  const edges = useMemo(() => {
    const m = new Map<string, { a: string; b: string }>();
    tests.forEach((t) => t.links.forEach((l) => {
      if (!pos.has(t.id) || !pos.has(l.id)) return;
      const key = [t.id, l.id].sort().join("|");
      if (!m.has(key)) m.set(key, { a: t.id, b: l.id });
    }));
    return Array.from(m.values());
  }, [tests, pos]);

  const focus = hover ?? sel;
  const neighbours = useMemo(() => {
    const s = new Set<string>();
    if (focus) edges.forEach((e) => { if (e.a === focus) s.add(e.b); if (e.b === focus) s.add(e.a); });
    return s;
  }, [focus, edges]);

  const selTest = tests.find((t) => t.id === sel) ?? null;
  const selLinks = selTest
    ? [
        ...selTest.links.map((l) => ({ t: tests.find((x) => x.id === l.id), note: l.note, dir: "out" as const })),
        ...tests.filter((x) => x.id !== selTest.id && x.links.some((l) => l.id === selTest.id) && !selTest.links.some((l) => l.id === x.id))
          .map((x) => ({ t: x, note: x.links.find((l) => l.id === selTest.id)?.note, dir: "in" as const })),
      ].filter((x) => x.t)
    : [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Network className="size-6 text-brand" /> خريطة الربط</h1>
          <p className="mt-1 text-sm text-muted">كل نقطة فحص، وكل خط ربط بين فحصين. اضغط على فحص لرؤية روابطه وأسبابها.</p>
        </div>
        <label className="inline-flex items-center gap-1.5 text-sm"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="accent-[var(--color-brand)]" /> إظهار الفحوصات غير المرتبطة</label>
      </div>

      {nodes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">لا توجد روابط بعد — أضف الروابط من «تعديل» في صفحة أي فحص.</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-card)]">
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-[720px]" onClick={() => setSel(null)}>
              {edges.map((e) => {
                const p = pos.get(e.a)!, q = pos.get(e.b)!;
                const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
                const cx = mx * 0.45 + C * 0.55, cy = my * 0.45 + C * 0.55;
                const on = !!focus && (e.a === focus || e.b === focus);
                return (
                  <path key={e.a + e.b} d={`M ${p.x} ${p.y} Q ${cx} ${cy} ${q.x} ${q.y}`} fill="none"
                    stroke={on ? color(pos.get(focus!)!.t) : "var(--color-line)"} strokeWidth={on ? 3 : 1.6}
                    opacity={focus && !on ? 0.25 : 1} />
                );
              })}
              {nodes.map((n) => {
                const dim = !!focus && n.t.id !== focus && !neighbours.has(n.t.id);
                const label = (n.t.abbr || n.t.name_ar).slice(0, 16);
                return (
                  <g key={n.t.id} className="cursor-pointer" opacity={dim ? 0.3 : 1}
                    onMouseEnter={() => setHover(n.t.id)} onMouseLeave={() => setHover(null)}
                    onClick={(ev) => { ev.stopPropagation(); setSel(n.t.id); }}>
                    <circle cx={n.x} cy={n.y} r={22} fill="transparent" />
                    <circle cx={n.x} cy={n.y} r={n.t.id === sel ? 13 : 10} fill={color(n.t)} stroke="white" strokeWidth={3} />
                    <text x={n.lx} y={n.ly} textAnchor="middle" dominantBaseline="middle" fontSize={13} fontWeight={n.t.id === focus ? 700 : 500} fill="var(--color-ink)">{label}</text>
                  </g>
                );
              })}
            </svg>
            <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs">
              {cats.map((c, i) => <span key={c} className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} /> {c}</span>)}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
            {!selTest ? (
              <p className="text-sm text-muted">اضغط على أي فحص في الخريطة.</p>
            ) : (
              <>
                <div className="text-lg font-bold">{selTest.name_ar}</div>
                {selTest.abbr && <div className="text-xs text-muted" dir="ltr" style={{ textAlign: "right" }}>{selTest.abbr}</div>}
                <Link href={`/training/test/${selTest.id}`} className="mt-2 inline-block rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark">فتح بطاقة الفحص</Link>
                <div className="mt-4 mb-2 text-xs font-semibold text-muted">الروابط ({selLinks.length})</div>
                <div className="flex flex-col gap-2">
                  {selLinks.map((l) => (
                    <button key={l.t!.id} onClick={() => setSel(l.t!.id)} className="rounded-xl border border-line p-2.5 text-right hover:border-brand">
                      <div className="flex items-center gap-1.5 text-sm font-semibold"><ArrowLeftRight className="size-3.5 text-brand" /> {l.t!.name_ar}</div>
                      {l.note && <div className="mt-0.5 text-xs text-muted">{l.note}</div>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

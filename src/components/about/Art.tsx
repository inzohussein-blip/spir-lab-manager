import type { ReactNode } from "react";
import type { ArtName } from "@/lib/about/content";

/**
 * Simplified pictures for «عن التطبيق»: small drawings of each station and idea, drawn with
 * the theme's colours (light and dark) — no image files, so they work offline and stay sharp.
 */

const C = {
  station: "#0d9488", store: "#d97706", training: "#4f46e5", qc: "#e11d48", roster: "#0284c7", sync: "#7c3aed",
  ok: "#16a34a", warn: "#f59e0b", bad: "#dc2626", admin: "#5a2a82",
};
const SURF = "var(--color-surface)";
const CANVAS = "var(--color-canvas)";
const LINE = "var(--color-line)";
const MUTED = "var(--color-muted)";
const INK = "var(--color-ink)";

function T({ x, y, children, size = 11, fill = INK, weight = 600, anchor = "middle", ltr = false }: {
  x: number; y: number; children: ReactNode; size?: number; fill?: string; weight?: number; anchor?: "start" | "middle" | "end"; ltr?: boolean;
}) {
  if (ltr) return <text x={x} y={y} fontSize={size} fill={fill} fontWeight={weight} textAnchor={anchor} direction="ltr" dominantBaseline="middle">{children}</text>;
  // `anchor` is physical (start = left edge at x); under direction="rtl" SVG flips start and end.
  const rtl = anchor === "middle" ? "middle" : anchor === "start" ? "end" : "start";
  return <text x={x} y={y} fontSize={size} fill={fill} fontWeight={weight} textAnchor={rtl} direction="rtl" dominantBaseline="middle">{children}</text>;
}

/** An app window: title bar and a sidebar on the right (RTL) with its first item active. */
function Win({ x, y, w, h, accent, items = 5, children }: { x: number; y: number; w: number; h: number; accent: string; items?: number; children?: ReactNode }) {
  const sw = Math.min(70, w * 0.24);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={10} fill={SURF} stroke={LINE} strokeWidth={1.5} />
      <rect x={x} y={y} width={w} height={16} rx={10} fill={CANVAS} />
      <rect x={x} y={y + 10} width={w} height={6} fill={CANVAS} />
      {[0, 1, 2].map((i) => <circle key={i} cx={x + 12 + i * 9} cy={y + 8} r={2.6} fill={[C.bad, C.warn, C.ok][i]} />)}
      <rect x={x + w - sw} y={y + 16} width={sw} height={h - 16} fill={CANVAS} />
      <rect x={x + w - sw + 8} y={y + 24} width={sw - 16} height={10} rx={3} fill={accent} />
      {Array.from({ length: items }, (_, i) => (
        <g key={i}>
          <rect x={x + w - sw + 8} y={y + 44 + i * 15} width={sw - 16} height={9} rx={3} fill={i === 0 ? accent : LINE} opacity={i === 0 ? 0.35 : 1} />
        </g>
      ))}
      {children}
    </g>
  );
}

function Arrow({ x1, y1, x2, y2, color = MUTED, dash }: { x1: number; y1: number; x2: number; y2: number; color?: string; dash?: boolean }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const h = 7;
  return (
    <g stroke={color} fill={color}>
      <line x1={x1} y1={y1} x2={x2 - Math.cos(a) * 4} y2={y2 - Math.sin(a) * 4} strokeWidth={2} strokeDasharray={dash ? "4 4" : undefined} />
      <path d={`M${x2},${y2} L${x2 - h * Math.cos(a - 0.45)},${y2 - h * Math.sin(a - 0.45)} L${x2 - h * Math.cos(a + 0.45)},${y2 - h * Math.sin(a + 0.45)} Z`} stroke="none" />
    </g>
  );
}

function Laptop({ x, y, w = 90, color = C.sync, label }: { x: number; y: number; w?: number; color?: string; label?: string }) {
  const h = w * 0.6;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={SURF} stroke={color} strokeWidth={2} />
      <rect x={x + 8} y={y + 8} width={w - 16} height={h - 16} rx={3} fill={color} opacity={0.12} />
      <path d={`M${x - 10},${y + h + 2} h${w + 20} l-8,8 h${-(w + 4)} z`} fill={color} opacity={0.8} />
      {label && <T x={x + w / 2} y={y + h / 2} size={10} fill={INK}>{label}</T>}
    </g>
  );
}

function FileIcon({ x, y, color, label }: { x: number; y: number; color: string; label: string }) {
  return (
    <g>
      <path d={`M${x},${y} h26 l12,12 v38 h-38 z`} fill={SURF} stroke={color} strokeWidth={2} />
      <path d={`M${x + 26},${y} v12 h12`} fill="none" stroke={color} strokeWidth={2} />
      <T x={x + 19} y={y + 32} size={8} fill={color} weight={700}>{label}</T>
    </g>
  );
}

function Hub() {
  const nodes: [string, string][] = [["المختبر", C.station], ["المخزن", C.store], ["الجودة", C.qc], ["الكادر", C.roster], ["المزامنة", C.sync], ["التدريب", C.training]];
  const cx = 200, cy = 118, r = 88;
  const pos = nodes.map((_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / nodes.length; return [cx + Math.cos(a) * r * 1.45, cy + Math.sin(a) * r] as const; });
  const links: [number, number][] = [[0, 1], [1, 2], [2, 3], [0, 2]];
  return (
    <svg viewBox="0 0 400 236">
      {links.map(([a, b], i) => <line key={i} x1={pos[a][0]} y1={pos[a][1]} x2={pos[b][0]} y2={pos[b][1]} stroke={MUTED} strokeWidth={1.5} strokeDasharray="4 4" />)}
      {pos.map(([x, y], i) => <line key={`c${i}`} x1={cx} y1={cy} x2={x} y2={y} stroke={LINE} strokeWidth={2} />)}
      <Laptop x={cx - 40} y={cy - 30} w={80} color={C.sync} />
      <T x={cx} y={cy - 6} size={10}>حاسوب</T>
      <T x={cx} y={cy + 7} size={10}>المختبر</T>
      {pos.map(([x, y], i) => (
        <g key={i}>
          <rect x={x - 38} y={y - 15} width={76} height={30} rx={15} fill={nodes[i][1]} />
          <T x={x} y={y + 1} size={12} fill="#fff" weight={700}>{nodes[i][0]}</T>
        </g>
      ))}
    </svg>
  );
}

function Flow() {
  const steps: [string, string][] = [["المراجع", "الاسم والعمر"], ["الفحوص", "بحث أو باقة"], ["النتائج", "H و L تلقائياً"], ["حفظ", "رقم عينة"], ["طباعة", "أو واتساب"]];
  const w = 66, gap = 12, total = steps.length * w + (steps.length - 1) * gap, x0 = (400 - total) / 2;
  return (
    <svg viewBox="0 0 400 110">
      {steps.map(([t, s], i) => {
        const x = 400 - x0 - (i + 1) * w - i * gap; // right to left
        return (
          <g key={i}>
            <rect x={x} y={20} width={w} height={64} rx={12} fill={SURF} stroke={C.station} strokeWidth={1.8} />
            <circle cx={x + w / 2} cy={20} r={10} fill={C.station} />
            <T x={x + w / 2} y={21} size={10} fill="#fff" weight={700}>{i + 1}</T>
            <T x={x + w / 2} y={48} size={12}>{t}</T>
            <T x={x + w / 2} y={66} size={8.5} fill={MUTED} weight={500}>{s}</T>
            {i < steps.length - 1 && <Arrow x1={x - 1} y1={52} x2={x - gap + 1} y2={52} color={C.station} />}
          </g>
        );
      })}
    </svg>
  );
}

function StationArt() {
  return (
    <svg viewBox="0 0 400 230">
      <Win x={10} y={10} w={380} h={210} accent={C.station} items={6}>
        {/* the entry form (right) */}
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect x={212} y={36 + i * 22} width={80} height={14} rx={4} fill={CANVAS} stroke={LINE} />
          </g>
        ))}
        <T x={252} y={43} size={8} fill={MUTED} weight={500}>الاسم</T>
        <T x={252} y={65} size={8} fill={MUTED} weight={500}>العمر</T>
        <T x={252} y={87} size={8} fill={MUTED} weight={500}>الهاتف</T>
        {[["Glucose", "142", true], ["Urea", "31", false], ["Creat.", "0.9", false], ["TSH", "2.1", false]].map(([n, v, h], i) => (
          <g key={i}>
            <rect x={192} y={112 + i * 18} width={100} height={14} rx={3} fill={i % 2 ? SURF : CANVAS} stroke={LINE} />
            <text x={286} y={119 + i * 18} fontSize={8} fill={INK} textAnchor="end" dominantBaseline="middle">{n as string}</text>
            <text x={206} y={119 + i * 18} fontSize={8} fill={h ? C.bad : INK} fontWeight={h ? 700 : 400} textAnchor="start" dominantBaseline="middle">{v as string}{h ? " H" : ""}</text>
          </g>
        ))}
        <rect x={192} y={188} width={46} height={16} rx={5} fill={C.station} />
        <T x={215} y={196} size={8} fill="#fff">طباعة</T>
        <rect x={244} y={188} width={48} height={16} rx={5} fill="#22c55e" />
        <T x={268} y={196} size={8} fill="#fff">واتساب</T>
        {/* the report (left) */}
        <rect x={30} y={30} width={140} height={178} rx={4} fill="#fff" stroke={LINE} />
        <rect x={40} y={38} width={120} height={16} rx={3} fill={C.station} opacity={0.85} />
        <rect x={40} y={60} width={70} height={5} rx={2} fill="#cbd5e1" />
        <rect x={40} y={69} width={50} height={5} rx={2} fill="#cbd5e1" />
        <g>{Array.from({ length: 12 }, (_, i) => <rect key={i} x={128 + i * 2.6} y={60} width={i % 3 ? 1 : 1.8} height={14} fill="#0f172a" />)}</g>
        {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={40} y={86 + i * 13} width={120} height={9} rx={2} fill={i === 0 ? "#fee2e2" : i % 2 ? "#f1f5f9" : "#fff"} stroke="#e2e8f0" />)}
        <rect x={40} y={176} width={22} height={22} fill="#0f172a" opacity={0.85} />
        <rect x={120} y={186} width={40} height={2} fill="#94a3b8" />
      </Win>
    </svg>
  );
}

function ReportArt() {
  const labels: [number, string][] = [[46, "الترويسة والشعار"], [86, "المراجع والباركود"], [150, "جدول النتائج"], [226, "التوقيع ورمز QR"], [254, "سطر التذييل"]];
  return (
    <svg viewBox="-20 0 440 280">
      <rect x={130} y={20} width={180} height={250} rx={4} fill="#fff" stroke={LINE} strokeWidth={1.5} />
      <rect x={140} y={30} width={160} height={30} rx={4} fill={C.station} opacity={0.9} />
      <circle cx={285} cy={45} r={10} fill="#fff" opacity={0.9} />
      <rect x={180} y={40} width={90} height={5} rx={2} fill="#fff" />
      <rect x={200} y={49} width={70} height={4} rx={2} fill="#fff" opacity={0.8} />
      <rect x={140} y={68} width={160} height={34} rx={4} fill="#f8fafc" stroke="#e2e8f0" />
      <rect x={220} y={75} width={72} height={5} rx={2} fill="#cbd5e1" /><rect x={220} y={85} width={58} height={5} rx={2} fill="#cbd5e1" />
      <g>{Array.from({ length: 16 }, (_, i) => <rect key={i} x={148 + i * 3.2} y={76} width={i % 3 ? 1.2 : 2} height={18} fill="#0f172a" />)}</g>
      <rect x={140} y={108} width={160} height={11} fill={C.station} opacity={0.2} />
      {Array.from({ length: 7 }, (_, i) => <rect key={i} x={140} y={121 + i * 13} width={160} height={11} fill={i % 2 ? "#f1f5f9" : "#fff"} stroke="#e2e8f0" />)}
      <rect x={140} y={121} width={36} height={11} fill="#fee2e2" />
      <rect x={146} y={210} width={24} height={24} fill="#0f172a" opacity={0.85} />
      <rect x={236} y={228} width={56} height={2} fill="#94a3b8" />
      <rect x={140} y={248} width={160} height={12} rx={3} fill={C.station} opacity={0.7} />
      {labels.map(([y, t], i) => {
        const left = i % 2 === 1;
        return (
          <g key={i}>
            <line x1={left ? 124 : 316} x2={left ? 136 : 304} y1={y} y2={y} stroke={C.station} strokeWidth={1.5} />
            <circle cx={left ? 124 : 316} cy={y} r={3} fill={C.station} />
            <T x={left ? 118 : 322} y={y} size={10} anchor={left ? "end" : "start"}>{t}</T>
          </g>
        );
      })}
    </svg>
  );
}

function StoreArt() {
  return (
    <svg viewBox="0 0 400 170">
      {/* purchase (right) */}
      <rect x={290} y={40} width={96} height={90} rx={12} fill={SURF} stroke={C.store} strokeWidth={1.8} />
      <path d="M312,62 h8 l8,30 h36 l6,-22 h-46" fill="none" stroke={C.store} strokeWidth={3} strokeLinejoin="round" />
      <circle cx={332} cy={100} r={4} fill={C.store} /><circle cx={360} cy={100} r={4} fill={C.store} />
      <T x={338} y={118} size={11}>الشراء</T>
      {/* stock (middle) */}
      <rect x={140} y={20} width={120} height={130} rx={12} fill={SURF} stroke={C.store} strokeWidth={1.8} />
      <T x={200} y={36} size={11}>المخزن</T>
      {[["كاشف السكر", 0.8, C.ok], ["أنابيب EDTA", 0.45, C.warn], ["كاشف TSH", 0.08, C.bad]].map(([n, v, c], i) => (
        <g key={i}>
          <T x={250} y={58 + i * 30} size={8.5} anchor="end" weight={500}>{n as string}</T>
          <rect x={150} y={64 + i * 30} width={100} height={7} rx={3.5} fill={LINE} />
          <rect x={250 - 100 * (v as number)} y={64 + i * 30} width={100 * (v as number)} height={7} rx={3.5} fill={c as string} />
        </g>
      ))}
      {/* use (left) */}
      <rect x={14} y={40} width={96} height={90} rx={12} fill={SURF} stroke={C.station} strokeWidth={1.8} />
      <T x={62} y={70} size={11}>النتائج</T>
      <T x={62} y={88} size={11}>والسيطرة</T>
      <T x={62} y={110} size={9} fill={MUTED} weight={500}>تُحسم وحدة</T>
      <Arrow x1={288} y1={85} x2={262} y2={85} color={C.ok} />
      <T x={275} y={74} size={13} fill={C.ok} weight={800}>+</T>
      <Arrow x1={138} y1={85} x2={112} y2={85} color={C.bad} />
      <T x={125} y={74} size={13} fill={C.bad} weight={800}>−</T>
    </svg>
  );
}

function TrainingArt() {
  return (
    <svg viewBox="0 0 400 170">
      {/* open book */}
      <path d="M40,40 q60,-14 100,6 v100 q-40,-18 -100,-6 z" fill={SURF} stroke={C.training} strokeWidth={2} />
      <path d="M240,40 q-60,-14 -100,6 v100 q40,-18 100,-6 z" fill={SURF} stroke={C.training} strokeWidth={2} />
      {[0, 1, 2, 3, 4].map((i) => <g key={i}><line x1={55} x2={128} y1={58 + i * 14} y2={62 + i * 14} stroke={LINE} strokeWidth={3} strokeLinecap="round" /><line x1={152} x2={225} y1={62 + i * 14} y2={58 + i * 14} stroke={LINE} strokeWidth={3} strokeLinecap="round" /></g>)}
      <T x={140} y={160} size={11}>الدليل والمكتبة</T>
      {/* cards and a quiz */}
      <rect x={280} y={30} width={90} height={56} rx={8} fill={C.training} opacity={0.25} transform="rotate(-6 325 58)" />
      <rect x={280} y={30} width={90} height={56} rx={8} fill={SURF} stroke={C.training} strokeWidth={1.8} />
      <T x={325} y={58} size={16} fill={C.training} weight={800}>?</T>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={282} y={100 + i * 18} width={12} height={12} rx={3} fill={i === 1 ? C.ok : SURF} stroke={i === 1 ? C.ok : LINE} strokeWidth={1.5} />
          {i === 1 && <path d={`M285,${107 + i * 18} l3,3 l5,-6`} stroke="#fff" strokeWidth={2} fill="none" />}
          <rect x={300} y={103 + i * 18} width={66} height={6} rx={3} fill={LINE} />
        </g>
      ))}
    </svg>
  );
}

function QcArt() {
  const pts = [0.2, -0.6, 0.4, 1.1, -0.3, 0.7, -1.4, 0.1, 1.6, 0.5, -0.8, 3.3, 0.2];
  const y0 = 90, sd = 20, x0 = 50, dx = 26;
  const Y = (v: number) => y0 - v * sd;
  const lines: [number, string, string][] = [[3, C.bad, "+3SD"], [2, C.warn, "+2SD"], [0, C.ok, "المتوسط"], [-2, C.warn, "−2SD"], [-3, C.bad, "−3SD"]];
  return (
    <svg viewBox="0 0 400 180">
      {lines.map(([v, c, t]) => (
        <g key={v}>
          <line x1={x0} x2={x0 + dx * (pts.length - 1) + 10} y1={Y(v)} y2={Y(v)} stroke={c} strokeWidth={v === 0 ? 2 : 1.4} strokeDasharray={v === 0 ? undefined : "5 4"} />
          <T x={x0 - 6} y={Y(v)} size={8} fill={c} anchor="end" ltr={v !== 0}>{t}</T>
        </g>
      ))}
      <polyline points={pts.map((v, i) => `${x0 + i * dx},${Y(Math.max(-3.4, Math.min(3.4, v)))}`).join(" ")} fill="none" stroke={MUTED} strokeWidth={1.5} />
      {pts.map((v, i) => {
        const c = Math.abs(v) > 3 ? C.bad : Math.abs(v) > 2 ? C.warn : C.qc;
        return <circle key={i} cx={x0 + i * dx} cy={Y(Math.max(-3.4, Math.min(3.4, v)))} r={Math.abs(v) > 3 ? 5.5 : 4} fill={c} stroke={SURF} strokeWidth={1.5} />;
      })}
      <T x={x0 + 11 * dx} y={Y(3.4) - 12} size={9} fill={C.bad}>رفض</T>
      <T x={200} y={170} size={9} fill={MUTED} weight={500}>الأيام ←</T>
    </svg>
  );
}

function RosterArt() {
  const days = ["سبت", "أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس"];
  const staff = ["أحمد", "سارة", "علي", "زينب"];
  const grid = [[1, 1, 2, 2, 0, 1], [2, 2, 1, 1, 1, 0], [1, 0, 3, 3, 2, 2], [0, 1, 1, 2, 2, 1]];
  const col = ["transparent", C.roster, "#8b5cf6", C.warn];
  const cw = 46, ch = 26, gx = 34, gy = 34;
  return (
    <svg viewBox="0 0 400 170">
      {days.map((d, i) => <T key={d} x={400 - gx - 60 - i * cw - cw / 2} y={gy - 12} size={9} fill={MUTED} weight={500}>{d}</T>)}
      {staff.map((s, r) => (
        <g key={s}>
          <T x={400 - gx - 30} y={gy + r * ch + ch / 2} size={10}>{s}</T>
          {grid[r].map((v, i) => (
            <rect key={i} x={400 - gx - 60 - (i + 1) * cw + 3} y={gy + r * ch + 3} width={cw - 6} height={ch - 6} rx={5}
              fill={v ? col[v] : CANVAS} opacity={v ? 0.85 : 1} stroke={LINE} />
          ))}
        </g>
      ))}
      {[["صباحي", C.roster], ["مسائي", "#8b5cf6"], ["إجازة", C.warn]].map(([t, c], i) => (
        <g key={t}>
          <rect x={300 - i * 80} y={150} width={12} height={12} rx={3} fill={c} />
          <T x={294 - i * 80} y={156} size={9} anchor="end" weight={500}>{t}</T>
        </g>
      ))}
    </svg>
  );
}

function SyncArt() {
  return (
    <svg viewBox="0 0 400 180">
      <Laptop x={290} y={80} w={90} label="الحاسوب 1" />
      <Laptop x={20} y={80} w={90} label="الحاسوب 2" />
      <FileIcon x={181} y={100} color={C.sync} label="ملف" />
      <Arrow x1={286} y1={122} x2={226} y2={122} color={C.sync} />
      <Arrow x1={176} y1={122} x2={116} y2={122} color={C.sync} />
      <path d="M170,52 a18,18 0 0 1 30,-16 a22,22 0 0 1 38,10 a14,14 0 0 1 -2,28 h-62 a12,12 0 0 1 -4,-22 z" fill={SURF} stroke={C.sync} strokeWidth={2} />
      <T x={204} y={64} size={9} fill={C.sync}>تلقائي</T>
      <Arrow x1={300} y1={78} x2={244} y2={62} color={C.sync} dash />
      <Arrow x1={164} y1={64} x2={104} y2={78} color={C.sync} dash />
    </svg>
  );
}

function OfflineArt() {
  return (
    <svg viewBox="0 0 400 170">
      <Laptop x={150} y={40} w={100} color={C.station} label="بياناتك هنا" />
      <g transform="translate(300 60)" stroke={MUTED} fill="none" strokeWidth={3} strokeLinecap="round">
        <path d="M-22,-4 a32,32 0 0 1 44,0" /><path d="M-14,5 a20,20 0 0 1 28,0" /><circle cx={0} cy={14} r={2.5} fill={MUTED} />
        <line x1={-24} y1={-16} x2={24} y2={24} stroke={C.bad} />
      </g>
      <T x={300} y={105} size={10} fill={MUTED} weight={500}>بدون إنترنت</T>
      <circle cx={95} cy={70} r={20} fill={C.ok} />
      <path d="M85,70 l7,7 l13,-14" stroke="#fff" strokeWidth={3.5} fill="none" strokeLinecap="round" />
      <T x={95} y={105} size={10} fill={C.ok}>يعمل</T>
    </svg>
  );
}

function BackupArt() {
  return (
    <svg viewBox="0 0 400 150">
      <Laptop x={284} y={40} w={90} color={C.station} label="المحطة" />
      <Arrow x1={276} y1={75} x2={232} y2={75} color={C.station} />
      <FileIcon x={181} y={50} color={C.station} label="نسخة" />
      <Arrow x1={172} y1={75} x2={128} y2={75} color={C.station} />
      {/* a USB stick */}
      <rect x={40} y={60} width={70} height={32} rx={8} fill={C.station} />
      <rect x={20} y={66} width={22} height={20} rx={3} fill={SURF} stroke={C.station} strokeWidth={2} />
      <T x={75} y={77} size={10} fill="#fff">فلاش</T>
      <T x={200} y={132} size={10} fill={MUTED} weight={500}>كل أسبوع على الأقل</T>
    </svg>
  );
}

function ActivationArt() {
  return (
    <svg viewBox="0 0 400 150">
      <rect x={250} y={50} width={130} height={44} rx={10} fill={SURF} stroke={C.sync} strokeWidth={2} />
      <text x={315} y={73} fontSize={14} fontWeight={700} fill={C.sync} textAnchor="middle" dominantBaseline="middle" letterSpacing={2}>LAB-XXXX</text>
      <T x={315} y={110} size={10} fill={MUTED} weight={500}>رمز المختبر</T>
      <Arrow x1={244} y1={72} x2={206} y2={72} color={C.sync} />
      <rect x={168} y={62} width={30} height={26} rx={5} fill={C.ok} />
      <path d="M174,62 v-8 a10,10 0 0 1 20,-2" fill="none" stroke={C.ok} strokeWidth={3.5} />
      <Arrow x1={160} y1={72} x2={122} y2={72} color={C.sync} />
      {[C.station, C.store, C.training, C.qc, C.roster, C.sync].map((c, i) => <circle key={i} cx={40 + (i % 3) * 28} cy={58 + Math.floor(i / 3) * 28} r={10} fill={c} />)}
      <T x={68} y={125} size={10} fill={MUTED} weight={500}>المحطات مفعّلة</T>
    </svg>
  );
}

function AdminArt() {
  return (
    <svg viewBox="0 0 400 160">
      <path d="M160,60 a22,22 0 0 1 36,-20 a26,26 0 0 1 46,12 a18,18 0 0 1 -2,36 h-76 a15,15 0 0 1 -4,-28 z" fill={SURF} stroke={C.admin} strokeWidth={2} />
      <g transform="translate(200 70)"><ellipse cx={0} cy={-8} rx={14} ry={5} fill={C.admin} /><rect x={-14} y={-8} width={28} height={18} fill={C.admin} opacity={0.8} /><ellipse cx={0} cy={10} rx={14} ry={5} fill={C.admin} /></g>
      <Laptop x={40} y={100} w={70} color={C.admin} />
      <rect x={290} y={96} width={30} height={50} rx={6} fill={SURF} stroke={C.admin} strokeWidth={2} />
      <rect x={330} y={100} width={46} height={40} rx={4} fill={SURF} stroke={C.admin} strokeWidth={2} />
      <Arrow x1={110} y1={104} x2={162} y2={84} color={C.admin} dash />
      <Arrow x1={300} y1={94} x2={240} y2={84} color={C.admin} dash />
    </svg>
  );
}

function AccountsArt() {
  return (
    <svg viewBox="0 0 400 170">
      {/* money in (right) */}
      <rect x={292} y={38} width={94} height={84} rx={12} fill={SURF} stroke={C.ok} strokeWidth={1.8} />
      <T x={339} y={62} size={11}>الداخل</T>
      <T x={339} y={82} size={8.5} fill={MUTED} weight={500}>دفعات الفواتير</T>
      <T x={339} y={98} size={8.5} fill={MUTED} weight={500}>والطلبات المدفوعة</T>
      <Arrow x1={288} y1={80} x2={252} y2={80} color={C.ok} />
      {/* the drawer (middle) */}
      <rect x={148} y={30} width={104} height={100} rx={14} fill={SURF} stroke={C.admin} strokeWidth={2} />
      <rect x={160} y={78} width={80} height={34} rx={6} fill={C.admin} opacity={0.15} />
      <rect x={188} y={92} width={24} height={5} rx={2.5} fill={C.admin} />
      <circle cx={180} cy={58} r={9} fill={C.warn} /><circle cx={200} cy={54} r={9} fill={C.warn} opacity={0.85} /><circle cx={220} cy={58} r={9} fill={C.warn} opacity={0.7} />
      <T x={200} y={148} size={11}>الصندوق — إغلاق اليوم</T>
      {/* money out (left) */}
      <Arrow x1={146} y1={80} x2={110} y2={80} color={C.bad} />
      <rect x={14} y={38} width={94} height={84} rx={12} fill={SURF} stroke={C.bad} strokeWidth={1.8} />
      <T x={61} y={62} size={11}>المصروف</T>
      <T x={61} y={82} size={8.5} fill={MUTED} weight={500}>إيجار، كهرباء</T>
      <T x={61} y={98} size={8.5} fill={MUTED} weight={500}>رواتب، مشتريات</T>
    </svg>
  );
}

const ARTS: Record<ArtName, () => React.JSX.Element> = {
  hub: Hub, flow: Flow, station: StationArt, report: ReportArt, store: StoreArt, training: TrainingArt, qc: QcArt,
  roster: RosterArt, sync: SyncArt, offline: OfflineArt, backup: BackupArt, activation: ActivationArt, admin: AdminArt, accounts: AccountsArt,
};

export function Art({ name, caption }: { name: ArtName; caption?: string }) {
  const Pic = ARTS[name];
  return (
    <figure className="my-3 rounded-2xl border border-line bg-canvas p-3" data-art={name}>
      <div className="mx-auto max-w-xl [&_svg]:h-auto [&_svg]:w-full" role="img" aria-label={caption ?? name}><Pic /></div>
      {caption && <figcaption className="mt-1 text-center text-xs text-muted">{caption}</figcaption>}
    </figure>
  );
}

import Link from "next/link";

const TABS = [
  ["/staff", "الكادر والبدلاء"], ["/staff/attendance", "الحضور والانصراف"], ["/staff/leaves", "الإجازات والسُّلف"], ["/staff/payroll", "الرواتب"],
] as const;

/** The staff section's pages. */
export function StaffTabs({ active }: { active: string }) {
  return (
    <nav className="no-print mb-5 flex flex-wrap gap-1 rounded-xl bg-canvas p-1 text-sm" data-testid="staff-tabs">
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} aria-current={active === href ? "page" : undefined}
          className={`rounded-lg px-3 py-1.5 font-semibold ${active === href ? "bg-surface text-brand-dark shadow-sm" : "text-muted hover:text-ink"}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

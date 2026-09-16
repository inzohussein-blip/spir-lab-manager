import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface p-5 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "brand",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "brand" | "warn" | "danger" | "neutral";
}) {
  const tones: Record<string, string> = {
    brand: "text-brand-dark",
    warn: "text-amber-600",
    danger: "text-red-600",
    neutral: "text-ink",
  };
  return (
    <Card>
      <div className="text-sm text-muted">{label}</div>
      <div className={cn("mt-1 text-3xl font-bold", tones[tone])}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

export function Button({
  href,
  children,
  variant = "primary",
  className,
  ...props
}: {
  href?: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = cn(
    "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
    variant === "primary"
      ? "bg-brand text-white hover:bg-brand-dark"
      : "border border-line text-ink hover:bg-canvas",
    className
  );
  if (href) {
    return (
      <Link href={href} className={styles}>
        {children}
      </Link>
    );
  }
  return (
    <button className={styles} {...props}>
      {children}
    </button>
  );
}

export function FlagChip({ flag }: { flag: string | null }) {
  if (!flag || flag === "N") return <span className="text-muted">—</span>;
  return (
    <span className={flag === "H" ? "flag-H" : "flag-L"}>
      {flag === "H" ? "H مرتفع" : "L منخفض"}
    </span>
  );
}

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
        "rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]",
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
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "brand" | "warn" | "danger" | "neutral";
  icon?: ReactNode;
}) {
  const tones: Record<string, string> = {
    brand: "text-brand-dark",
    warn: "text-amber-600",
    danger: "text-red-600",
    neutral: "text-ink",
  };
  const iconTones: Record<string, string> = {
    brand: "bg-brand-light text-brand-dark",
    warn: "bg-amber-50 text-amber-600",
    danger: "bg-red-50 text-red-600",
    neutral: "bg-canvas text-muted",
  };
  return (
    <Card className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm text-muted">{label}</div>
        <div className={cn("mt-1 text-3xl font-bold tabular-nums", tones[tone])}>{value}</div>
        {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
      </div>
      {icon && (
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", iconTones[tone])}>
          {icon}
        </span>
      )}
    </Card>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "warn" | "danger" | "info";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-canvas text-muted",
    brand: "bg-teal-50 text-brand-dark",
    warn: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-600",
    info: "bg-blue-50 text-blue-600",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && (
        <span className="grid size-12 place-items-center rounded-2xl bg-canvas text-muted">
          {icon}
        </span>
      )}
      <div className="font-semibold">{title}</div>
      {hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 w-full", className)} />;
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

import Link from "next/link";
import { ArrowLeft, Lightbulb, TriangleAlert, Home, ChevronDown } from "lucide-react";
import { ABOUT, aboutHref, aboutPage, type AboutBlock, type AboutPage } from "@/lib/about/content";
import { Art } from "./Art";

const card = "rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]";

function Block({ b }: { b: AboutBlock }) {
  if ("p" in b) return <p className="my-2">{b.p}</p>;
  if ("list" in b) return <ul className="my-2 list-disc space-y-1 ps-5">{b.list.map((x, i) => <li key={i}>{x}</li>)}</ul>;
  if ("steps" in b) {
    return (
      <ol className="my-2 space-y-2">
        {b.steps.map((x, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>
            <span className="pt-0.5">{x}</span>
          </li>
        ))}
      </ol>
    );
  }
  if ("note" in b) {
    const warn = b.tone === "warn";
    const Icon = warn ? TriangleAlert : Lightbulb;
    return (
      <div className={`my-3 flex gap-2 rounded-xl border px-3 py-2 text-sm ${warn ? "border-amber-300 bg-amber-50 text-amber-900" : "border-sky-200 bg-sky-50 text-sky-900"}`}>
        <Icon className="mt-0.5 size-4 shrink-0" /><span>{b.note}</span>
      </div>
    );
  }
  if ("features" in b) {
    return (
      <div className="my-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {b.features.map((f) => (
          <div key={f.title} className="rounded-xl border border-line bg-canvas p-3">
            <div className="font-bold text-brand-dark">{f.title}</div>
            <div className="mt-0.5 text-sm text-muted">{f.text}</div>
          </div>
        ))}
      </div>
    );
  }
  if ("art" in b) return <Art name={b.art} caption={b.caption} />;
  if ("table" in b) {
    return (
      <div className="my-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead><tr>{b.table.head.map((h) => <th key={h} className="border border-line bg-brand-light px-3 py-2 text-start font-bold text-brand-dark">{h}</th>)}</tr></thead>
          <tbody>
            {b.table.rows.map((r, i) => (
              <tr key={i} className={i % 2 ? "bg-canvas" : undefined}>
                {r.map((c, j) => <td key={j} className={`border border-line px-3 py-1.5 align-top ${j === 0 ? "font-semibold" : ""}`}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if ("faq" in b) {
    return (
      <div className="my-2 grid gap-2" data-testid="about-faq">
        {b.faq.map((f) => (
          <details key={f.q} className="group rounded-xl border border-line bg-canvas px-4 py-2.5">
            <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold [&::-webkit-details-marker]:hidden">
              {f.q}<ChevronDown className="ms-auto size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-2 text-sm text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    );
  }
  return (
    <div className="my-3 grid gap-2.5 sm:grid-cols-2">
      {b.links.map((l) => {
        const pg = aboutPage(l.slug);
        if (!pg) return null;
        return (
          <Link key={l.slug} href={aboutHref(l.slug)} className="group flex gap-3 rounded-xl border border-line bg-canvas p-3 hover:border-brand">
            <span className="mt-1 size-3 shrink-0 rounded-full" style={{ background: pg.color }} />
            <span className="min-w-0 flex-1">
              <span className="block font-bold group-hover:text-brand-dark">{pg.title}</span>
              <span className="block text-sm text-muted">{l.text}</span>
            </span>
            <ArrowLeft className="mt-1 size-4 shrink-0 text-muted group-hover:text-brand" />
          </Link>
        );
      })}
    </div>
  );
}

/** One page of «عن التطبيق» (fixed text; nothing here is editable). */
export function AboutView({ page }: { page: AboutPage }) {
  const i = ABOUT.indexOf(page);
  const prev = ABOUT[i - 1], next = ABOUT[i + 1];
  return (
    <article className="mx-auto max-w-4xl text-[15px] leading-relaxed" data-testid="about-page" data-slug={page.slug}>
      <header className="mb-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
        <div className="h-1.5" style={{ background: page.color }} />
        <div className="flex flex-wrap items-start gap-3 p-5">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold">{page.title}</h1>
            <p className="mt-1.5 text-muted">{page.lead}</p>
          </div>
          {page.open && (
            // Every page leads back to the welcome page; the station opens from its card there.
            <Link href="/welcome" className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: page.color }} data-testid="about-open">
              <Home className="size-4" /> تُفتح من الصفحة الرئيسية
            </Link>
          )}
        </div>
      </header>

      <div className="grid gap-5">
        {page.sections.map((s) => (
          <section key={s.title} className={card}>
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
              <span className="h-5 w-1.5 rounded bg-brand" /> {s.title}
            </h2>
            {s.blocks.map((b, j) => <Block key={j} b={b} />)}
          </section>
        ))}
      </div>

      <nav className="mt-6 flex items-center justify-between gap-3 text-sm">
        {prev ? <Link href={aboutHref(prev.slug)} className="rounded-lg border border-line bg-surface px-3 py-2 hover:border-brand">→ {prev.title}</Link> : <span />}
        {next ? <Link href={aboutHref(next.slug)} className="rounded-lg border border-line bg-surface px-3 py-2 hover:border-brand" data-testid="about-next">{next.title} ←</Link> : <span />}
      </nav>
    </article>
  );
}

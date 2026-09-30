"use client";

import { useEffect, useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

/** Folding the stations' side menu on a computer (phones keep their slide-in menu). Remembered on
 *  this device for every station. */
const KEY = "local.sidebar.collapsed";
const EVT = "local-sidebar";

export function useSideCollapsed(): [boolean, (v: boolean) => void] {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const read = () => { try { setCollapsed(localStorage.getItem(KEY) === "1"); } catch { /* ignore */ } };
    read();
    window.addEventListener(EVT, read);
    return () => window.removeEventListener(EVT, read);
  }, []);
  const set = (v: boolean) => {
    try { if (v) localStorage.setItem(KEY, "1"); else localStorage.removeItem(KEY); } catch { /* ignore */ }
    setCollapsed(v);
    window.dispatchEvent(new Event(EVT));
  };
  return [collapsed, set];
}

/** The small mark at the top of the side menu that folds it away. */
export function SideCollapseButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} title="طيّ القائمة الجانبية" aria-label="طيّ القائمة الجانبية" data-testid="side-collapse"
      className="hidden size-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink md:grid">
      <PanelRightClose className="size-4" />
    </button>
  );
}

/** A thin strip in place of the folded menu (it keeps its place, so the page never slides under
 *  it), with the mark that opens the menu again. */
export function SideReopenButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="no-print sticky top-0 hidden h-screen w-12 shrink-0 flex-col items-center border-e border-line bg-surface pt-4 md:flex">
      <button onClick={onClick} title="إظهار القائمة الجانبية" aria-label="إظهار القائمة الجانبية" data-testid="side-reopen"
        className="grid size-8 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink">
        <PanelRightOpen className="size-4" />
      </button>
    </div>
  );
}

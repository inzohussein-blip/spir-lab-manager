"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { isBarePath } from "@/lib/barePaths";

/**
 * The root layout draws the admin panel's frame (side menu, top bar) or none, by the page it was
 * first loaded for, and Next keeps it across in-app navigations. So a link, a sign-in or a sign-out
 * that crosses between the panel and the pages outside it (welcome, stations, login) loads the new
 * page afresh — otherwise the welcome page would show inside the panel, or the panel without its
 * menu and «خروج».
 */
export function LayoutGuard() {
  const pathname = usePathname();
  const first = useRef<boolean | null>(null);
  useEffect(() => {
    const bare = isBarePath(pathname);
    if (first.current === null) { first.current = bare; return; }
    if (first.current !== bare) window.location.replace(window.location.href);
  }, [pathname]);
  return null;
}

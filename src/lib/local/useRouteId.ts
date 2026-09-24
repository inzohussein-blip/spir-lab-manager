"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** The last URL segment (an item id), read from the real address bar.
 *  Offline, one saved copy of a page serves every id, so the server-rendered
 *  params may belong to that copy — the address bar is always right.
 *  Returns null until known (first client render). */
export function useRouteId(): string | null {
  const pathname = usePathname();
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const seg = window.location.pathname.split("/").filter(Boolean).pop() ?? "";
    setId(decodeURIComponent(seg) || null);
  }, [pathname]);
  return id;
}

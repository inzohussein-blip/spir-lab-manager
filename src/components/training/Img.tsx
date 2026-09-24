"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { imageUrl } from "@/lib/training/media";

/** Shows an image stored in the Training station's IndexedDB. */
export function Img({ id, alt = "", className = "", onClick }: { id?: string; alt?: string; className?: string; onClick?: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    setSrc(null); setMissing(false);
    if (!id) return;
    imageUrl(id).then((u) => { if (!alive) return; if (u) setSrc(u); else setMissing(true); }).catch(() => alive && setMissing(true));
    return () => { alive = false; };
  }, [id]);

  if (!id) return null;
  if (missing) {
    return <span className={`grid place-items-center bg-canvas text-muted ${className}`}><ImageOff className="size-5" /></span>;
  }
  if (!src) return <span className={`skeleton block ${className}`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} onClick={onClick} className={`object-contain ${className}`} />;
}

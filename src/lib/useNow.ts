"use client";

import { useEffect, useState } from "react";

/**
 * Current timestamp. Ticks every `intervalMs` while `active` is true, and
 * refreshes once whenever `deps` change so derived totals stay accurate.
 * Returns 0 until mounted, so nothing reads the clock during prerender.
 */
export function useNow(active: boolean, deps: unknown, intervalMs = 1000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = active ? window.setInterval(tick, intervalMs) : undefined;
    return () => {
      window.clearTimeout(first);
      if (id !== undefined) window.clearInterval(id);
    };
  }, [active, deps, intervalMs]);
  return now;
}

"use client";

import { useEffect } from "react";

export function IosStandaloneIntercept() {
  useEffect(() => {
    const isStandalone =
      "standalone" in window.navigator &&
      (window.navigator as { standalone: boolean }).standalone;

    if (!isStandalone) return;

    function handleClick(e: MouseEvent) {
      let el = e.target as HTMLElement | null;

      // Walk up DOM to find the anchor
      while (el && el.nodeName !== "A") {
        el = el.parentElement;
      }

      const anchor = el as HTMLAnchorElement | null;
      if (!anchor || !("href" in anchor)) return;
      if (!anchor.href.includes(window.location.host)) return;
      if (anchor.target && anchor.target !== "_self") return;

      e.preventDefault();
      window.location.href = anchor.href;
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}

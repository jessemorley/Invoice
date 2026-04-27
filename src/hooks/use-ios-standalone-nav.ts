import { useCallback } from "react";

export function useIosStandaloneNav() {
  return useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      const isStandalone =
        "standalone" in window.navigator &&
        (window.navigator as { standalone: boolean }).standalone;

      if (isStandalone) {
        e.preventDefault();
        window.location.href = href;
      }
    },
    []
  );
}

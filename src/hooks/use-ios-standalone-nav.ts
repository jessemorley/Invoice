import { useCallback } from "react";
import { useRouter } from "next/navigation";

export function useIosStandaloneNav() {
  const router = useRouter();

  return useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      const isStandalone =
        "standalone" in window.navigator &&
        (window.navigator as { standalone: boolean }).standalone;

      if (isStandalone) {
        e.preventDefault();
        router.push(href);
      }
    },
    [router]
  );
}

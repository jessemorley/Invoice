"use client";

import { useState } from "react";
import { AppSplash } from "@/components/app-splash";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

export default function SplashPreviewPage() {
  const [key, setKey] = useState(0);
  const { resolvedTheme, setTheme } = useTheme();

  function reset() {
    setKey((k) => k + 1);
  }

  function triggerFade() {
    window.dispatchEvent(new Event("app:ready"));
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <AppSplash key={key} />
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex gap-2 rounded-lg border bg-card px-3 py-2 shadow-lg">
        <Button size="sm" variant="outline" onClick={triggerFade}>
          Trigger fade
        </Button>
        <Button size="sm" variant="outline" onClick={reset}>
          Reset
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          Toggle theme
        </Button>
      </div>
    </div>
  );
}

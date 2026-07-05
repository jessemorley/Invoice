"use client";

import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";

// Renders a bottom Drawer on mobile (<768px) and a side Sheet on desktop.
// Width classes for the desktop sheet should use the md: prefix so they
// don't leak into the full-width mobile drawer.

const MobileContext = React.createContext(false);

function AdaptiveSheet(props: React.ComponentProps<typeof Sheet>) {
  const isMobile = useIsMobile();
  return (
    <MobileContext.Provider value={isMobile}>
      {isMobile ? (
        // repositionInputs disabled: vaul's own keyboard-avoidance resizes/
        // offsets the drawer via inline styles, which fights our flex layout
        // (scroll area + pinned footer) and leaves a gap above the footer.
        <Drawer repositionInputs={false} {...props} />
      ) : (
        <Sheet {...props} />
      )}
    </MobileContext.Provider>
  );
}

function AdaptiveSheetContent({
  className,
  side = "right",
  ...props
}: React.ComponentProps<typeof SheetContent>) {
  const isMobile = React.useContext(MobileContext);
  if (isMobile) {
    return <DrawerContent className={cn("h-[100dvh] max-h-[100dvh]", className)} {...props} />;
  }
  return <SheetContent side={side} className={className} {...props} />;
}

function AdaptiveSheetClose(props: React.ComponentProps<typeof SheetClose>) {
  const isMobile = React.useContext(MobileContext);
  const Close = isMobile ? DrawerClose : SheetClose;
  return <Close {...props} />;
}

function AdaptiveSheetTitle(props: React.ComponentProps<typeof SheetTitle>) {
  const isMobile = React.useContext(MobileContext);
  const Title = isMobile ? DrawerTitle : SheetTitle;
  return <Title {...props} />;
}

export {
  AdaptiveSheet,
  AdaptiveSheetContent,
  AdaptiveSheetClose,
  AdaptiveSheetTitle,
};

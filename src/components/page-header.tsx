import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppMark } from "@/components/app-mark";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  mobileTitle?: React.ReactNode;
  children?: React.ReactNode;
  /** Large-title mode: the body renders its own heading, so this one fades in
   *  only once that heading has scrolled under the header. */
  titleHidden?: boolean;
  /** Hidden until the body's large title scrolls under the header. */
  borderHidden?: boolean;
  /** Mobile: rendered leftmost (the account avatar). */
  leading?: React.ReactNode;
  /** Mobile: show the app mark at the far right. */
  appMark?: boolean;
}

export function PageHeader({
  title,
  mobileTitle,
  children,
  titleHidden,
  borderHidden,
  leading,
  appMark,
}: PageHeaderProps) {
  const collapsingTitle = titleHidden !== undefined;

  return (
    <header
      className={cn(
        "flex h-14 items-center border-b transition-colors",
        // Large-title mode: flush with the page until the title docks, then it
        // lifts to a surface with its divider back.
        borderHidden
          ? "border-transparent bg-transparent md:border-border"
          : collapsingTitle && "max-md:bg-card"
      )}
    >
      <div className="relative flex items-center justify-between gap-2 w-full max-w-6xl mx-auto px-4 md:px-6">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <SidebarTrigger className="hidden md:flex" />
          {leading}
          {mobileTitle ? (
            <>
              <div className="md:hidden flex-1 min-w-0">{mobileTitle}</div>
              <h1 className="hidden md:block text-lg font-semibold">{title}</h1>
            </>
          ) : (
            <h1
              className={cn(
                "text-lg font-semibold",
                // In large-title mode the body owns the mobile title; the collapsed
                // one is the centred span below.
                collapsingTitle && "max-md:opacity-0 max-md:pointer-events-none"
              )}
            >
              {title}
            </h1>
          )}
        </div>
        {/* Collapsed mobile title: centred across the full header, a size down
            from the body's large title. Behind the buttons, so it can't take taps. */}
        {collapsingTitle && !mobileTitle && (
          <span
            className={cn(
              "md:hidden absolute inset-x-0 text-center text-[15px] font-semibold pointer-events-none transition-opacity duration-150",
              titleHidden ? "opacity-0" : "opacity-100"
            )}
            aria-hidden
          >
            {title}
          </span>
        )}
        {(children || appMark) && (
          <div className="flex items-center gap-2">
            {children}
            {appMark && <AppMark className="md:hidden size-6 text-foreground/80" />}
          </div>
        )}
      </div>
    </header>
  );
}

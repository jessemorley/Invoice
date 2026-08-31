"use client";

import { LogOut, Settings } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser, userInitials } from "@/components/current-user-context";
import { useActiveView } from "@/components/active-view-context";
import { signOut } from "@/app/login/actions";

/** Mobile-only echo of the sidebar's NavUser: same initials, same menu. */
export function HeaderUserAvatar() {
  const user = useCurrentUser();
  const { setView } = useActiveView();
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="md:hidden focus:outline-none" aria-label="Account">
          <Avatar className="size-6 rounded-md">
            <AvatarFallback className="rounded-md text-[10px]">{userInitials(user.name)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <div className="flex items-center gap-2 px-1 py-1.5 text-sm">
          <Avatar className="size-8 rounded-lg">
            <AvatarFallback className="rounded-lg">{userInitials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 leading-tight min-w-0">
            <span className="truncate font-medium">{user.name}</span>
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setView("settings", { settingsTab: "account" })}>
          <Settings />Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut()}>
          <LogOut />Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { createContext, useContext } from "react";

export type CurrentUser = { name: string; email: string };

const CurrentUserContext = createContext<CurrentUser | null>(null);

export function CurrentUserProvider({
  user,
  children,
}: {
  user: CurrentUser;
  children: React.ReactNode;
}) {
  return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>;
}

/** Null until the layout's auth fetch resolves, so callers must handle absence. */
export function useCurrentUser(): CurrentUser | null {
  return useContext(CurrentUserContext);
}

export function userInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

"use client";

import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CommandPalette } from "@/components/CommandPalette";
import { NewButton } from "@/components/NewButton";
import { SyncStatus } from "@/components/offline/SyncStatus";
import type { SessionUser } from "@/lib/auth/session";

export function Topbar({ user }: { user: SessionUser }) {
  return (
    <header className="no-print sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur md:px-7">
      <div className="flex flex-1 items-center gap-3">
        <NewButton />
        <div className="hidden flex-1 sm:block">
          <CommandPalette role={user.role} />
        </div>
      </div>
      <div className="flex items-center gap-1">
        <SyncStatus />
        <span className="hidden text-sm text-muted md:inline">
          مرحباً، <span className="font-semibold text-ink">{user.full_name}</span>
        </span>
        <ThemeToggle />
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-canvas hover:text-ink"
          >
            <LogOut className="size-4" />
            خروج
          </button>
        </form>
      </div>
    </header>
  );
}

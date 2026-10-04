"use client";

import { LogOut, Home } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CommandPalette } from "@/components/CommandPalette";
import { NewButton } from "@/components/NewButton";
import { MobileNav } from "@/components/MobileNav";
import { SyncStatus } from "@/components/offline/SyncStatus";
import type { SessionUser } from "@/lib/auth/session";
import type { NavBadges } from "@/components/Sidebar";

export function Topbar({ user, lab, badges }: { user: SessionUser; lab: { name: string; logo: string }; badges?: NavBadges }) {
  return (
    <header className="no-print sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur md:px-7">
      <div className="flex flex-1 items-center gap-3">
        <MobileNav role={user.role} lab={lab} badges={badges} />
        {user.role !== "collector" && <NewButton />}
        <div className="hidden flex-1 sm:block">
          <CommandPalette role={user.role} />
        </div>
      </div>
      <div className="flex items-center gap-1">
        <SyncStatus />
        <a href="/welcome" title="الصفحة الرئيسية" aria-label="الصفحة الرئيسية" data-testid="admin-home"
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-canvas hover:text-ink">
          <Home className="size-4" />
          <span className="hidden lg:inline">الصفحة الرئيسية</span>
        </a>
        <span className="hidden text-sm text-muted md:inline">
          مرحباً، <span className="font-semibold text-ink">{user.full_name}</span>
        </span>
        <ThemeToggle />
        <form action={async () => { await logoutAction(); window.location.replace("/login"); }}>
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

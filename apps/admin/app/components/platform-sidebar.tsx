"use client";

import {
  Activity,
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { apiRequest } from "../lib/api";
import { Logo } from "./logo";
import { NavLink } from "./nav-link";

export function PlatformSidebarNav() {
  const router = useRouter();

  async function logout() {
    await apiRequest("/manage/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  const base = "/dashboard/platform";

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Brand + exit to tenant app */}
      <div className="flex h-14 flex-col justify-center gap-0.5 border-b border-sidebar-border px-4">
        <Logo size={24} className="text-sidebar-foreground" />
        <Link
          href="/dashboard"
          className="flex items-center gap-1 pl-0.5 text-[11px] text-sidebar-foreground/40 transition-colors hover:text-sidebar-foreground/70"
        >
          <ChevronLeft className="h-3 w-3" />
          Exit operator console
        </Link>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto p-3">
        {/* Distinct operator banner */}
        <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-500" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
              Platform operator
            </p>
          </div>
          <p className="mt-0.5 text-xs text-sidebar-foreground/50">
            Restricted system-wide access
          </p>
        </div>

        <div className="flex flex-col gap-0.5">
          <NavLink href={base} exact>
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            Overview
          </NavLink>
          <NavLink href={`${base}/activity`}>
            <ScrollText className="h-4 w-4 shrink-0" />
            Activity
          </NavLink>
          <NavLink href={`${base}/health`}>
            <Activity className="h-4 w-4 shrink-0" />
            Health
          </NavLink>
        </div>
      </div>

      <div className="border-t border-sidebar-border p-3">
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Log out
        </button>
      </div>
    </aside>
  );
}

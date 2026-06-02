"use client";

import {
  Building2,
  ChevronDown,
  LogOut,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@structo/ui/lib/utils";

import { apiRequest } from "../lib/api";
import { Logo } from "./logo";
import { NavLink } from "./nav-link";

interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
}

interface OrgSidebarNavProps {
  organizationId: string;
}

export function OrgSidebarNav({ organizationId }: OrgSidebarNavProps) {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [isPlatformOperator, setIsPlatformOperator] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);

  const currentOrg = organizations.find((o) => o.id === organizationId);
  const otherOrgs = organizations.filter((o) => o.id !== organizationId);

  useEffect(() => {
    void apiRequest<OrganizationSummary[]>("/manage/organizations")
      .then(setOrganizations)
      .catch(() => {
        router.replace("/login");
      });
  }, [organizationId, router]);

  useEffect(() => {
    void apiRequest<{ platformOperator: { role: string } | null }>(
      "/manage/auth/me",
    )
      .then((me) => setIsPlatformOperator(me.platformOperator !== null))
      .catch(() => setIsPlatformOperator(false));
  }, []);

  async function logout() {
    await apiRequest("/manage/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  const base = `/dashboard/organizations/${organizationId}`;

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Logo className="text-sidebar-foreground" />
      </div>

      {/* Nav area */}
      <div className="flex flex-1 flex-col overflow-y-auto p-3">
        {/* Org context header */}
        <div className="mb-2 px-1">
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            Organization
          </p>
          <button
            type="button"
            onClick={() => setShowSwitcher((v) => !v)}
            className={cn(
              "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors",
              "hover:bg-sidebar-accent",
              showSwitcher && "bg-sidebar-accent",
            )}
          >
            <span className="truncate text-sm font-semibold text-sidebar-foreground">
              {currentOrg?.name ?? "Loading…"}
            </span>
            {otherOrgs.length > 0 && (
              <ChevronDown
                className={cn(
                  "ml-1 h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40 transition-transform",
                  showSwitcher && "rotate-180",
                )}
              />
            )}
          </button>

          {showSwitcher && otherOrgs.length > 0 && (
            <div className="mt-1 rounded-md border border-sidebar-border bg-sidebar-accent/50 py-1">
              {otherOrgs.map((org) => (
                <Link
                  key={org.id}
                  href={`/dashboard/organizations/${org.id}`}
                  onClick={() => setShowSwitcher(false)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-foreground"
                >
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{org.name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Nav items */}
        <div className="mt-1 flex flex-col gap-0.5">
          <NavLink href={base} exact>
            <Building2 className="h-4 w-4 shrink-0" />
            Overview
          </NavLink>
          <NavLink href={`${base}/members`}>
            <Users className="h-4 w-4 shrink-0" />
            Members
          </NavLink>
          <NavLink href={`${base}/activity`}>
            <ScrollText className="h-4 w-4 shrink-0" />
            Activity
          </NavLink>
        </div>

        {isPlatformOperator && (
          <div className="mt-4">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
              Platform
            </p>
            <div className="flex flex-col gap-0.5">
              <NavLink href="/dashboard/platform">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                Operator console
              </NavLink>
            </div>
          </div>
        )}
      </div>

      {/* Logout */}
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

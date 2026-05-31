"use client";

import {
  ChevronLeft,
  FileText,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  Settings,
  Type,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@structo/ui/lib/utils";

import { apiRequest } from "../lib/api";
import { Logo } from "./logo";
import { NavLink } from "./nav-link";

interface SiteDetail {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "ARCHIVED";
}

interface OrganizationSummary {
  id: string;
  name: string;
}

interface SiteSidebarNavProps {
  siteId: string;
}

export function SiteSidebarNav({ siteId }: SiteSidebarNavProps) {
  const router = useRouter();
  const [site, setSite] = useState<SiteDetail | null>(null);
  const [organization, setOrganization] = useState<OrganizationSummary | null>(
    null,
  );

  useEffect(() => {
    void apiRequest<SiteDetail>(`/manage/sites/${siteId}`)
      .then(async (siteData) => {
        setSite(siteData);
        const org = await apiRequest<OrganizationSummary>(
          `/manage/organizations/${siteData.organizationId}`,
        );
        setOrganization(org);
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [router, siteId]);

  async function logout() {
    await apiRequest("/manage/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  const base = `/dashboard/sites/${siteId}`;

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Brand + back to org */}
      <div className="flex h-14 flex-col justify-center gap-0.5 border-b border-sidebar-border px-4">
        <Logo size={24} className="text-sidebar-foreground" />
        {organization && (
          <Link
            href={`/dashboard/organizations/${organization.id}`}
            className="flex items-center gap-1 pl-0.5 text-[11px] text-sidebar-foreground/40 transition-colors hover:text-sidebar-foreground/70"
          >
            <ChevronLeft className="h-3 w-3" />
            {organization.name}
          </Link>
        )}
      </div>

      {/* Nav area */}
      <div className="flex flex-1 flex-col overflow-y-auto p-3">
        {/* Site context header */}
        <div className="mb-3 px-1">
          <div className="mb-1 flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-primary/60">
              Site
            </p>
            {site && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                  site.status === "ACTIVE"
                    ? "bg-sidebar-primary/20 text-sidebar-primary"
                    : "bg-sidebar-foreground/10 text-sidebar-foreground/40",
                )}
              >
                {site.status}
              </span>
            )}
          </div>
          <p className="truncate text-sm font-semibold text-sidebar-foreground">
            {site?.name ?? "Loading…"}
          </p>
          {site && (
            <p className="truncate text-xs text-sidebar-foreground/40">
              {site.slug}
            </p>
          )}
        </div>

        {/* Overview */}
        <div className="flex flex-col gap-0.5">
          <NavLink href={base} exact>
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            Overview
          </NavLink>
        </div>

        {/* Content section */}
        <div className="mt-4">
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            Content
          </p>
          <div className="flex flex-col gap-0.5">
            <NavLink href={`${base}/content-types`}>
              <Type className="h-4 w-4 shrink-0" />
              Content Types
            </NavLink>
            <NavLink href={`${base}/entries`}>
              <FileText className="h-4 w-4 shrink-0" />
              Entries
            </NavLink>
            <NavLink href={`${base}/media`}>
              <ImageIcon className="h-4 w-4 shrink-0" />
              Media
            </NavLink>
          </div>
        </div>

        {/* Administration section */}
        <div className="mt-4">
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            Administration
          </p>
          <div className="flex flex-col gap-0.5">
            <NavLink href={`${base}/members`}>
              <Users className="h-4 w-4 shrink-0" />
              Members
            </NavLink>
            <NavLink href={`${base}/settings`}>
              <Settings className="h-4 w-4 shrink-0" />
              Settings
            </NavLink>
          </div>
        </div>
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

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiRequest } from "../lib/api";
import { ContextSwitcher } from "./context-switcher";

interface OrganizationSummary {
  id: string;
  name: string;
}

interface SiteSummary {
  id: string;
  name: string;
}

export function DashboardNavigation() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    async function loadNavigation() {
      try {
        const [nextOrganizations, nextSites] = await Promise.all([
          apiRequest<OrganizationSummary[]>("/manage/organizations"),
          apiRequest<SiteSummary[]>("/manage/sites"),
        ]);

        setOrganizations(nextOrganizations);
        setSites(nextSites);
      } catch {
        setError("Your session could not be loaded.");
      }
    }

    void loadNavigation();
  }, []);

  async function logout() {
    await apiRequest("/manage/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <Link className="sidebar-link" href="/dashboard">
        Dashboard
      </Link>
      <ContextSwitcher
        label="Organizations"
        items={organizations.map((organization) => ({
          href: `/dashboard/organizations/${organization.id}`,
          label: organization.name,
        }))}
      />
      <ContextSwitcher
        label="Sites"
        items={sites.map((site) => ({
          href: `/dashboard/sites/${site.id}`,
          label: site.name,
        }))}
      />
      {error ? <p className="sidebar-message">{error}</p> : null}
      <button className="sidebar-button" onClick={logout} type="button">
        Log out
      </button>
    </>
  );
}

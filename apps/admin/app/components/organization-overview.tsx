"use client";

import { Badge } from "@structo/ui/components/badge";
import { Button } from "@structo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@structo/ui/components/card";
import { Input } from "@structo/ui/components/input";
import { Label } from "@structo/ui/components/label";
import { Globe, Plus } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import { apiRequest } from "../lib/api";

interface OrganizationDetail {
  id: string;
  name: string;
  slug: string;
}

interface SiteSummary {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "ARCHIVED";
}

interface OrganizationOverviewProps {
  organizationId: string;
}

export function OrganizationOverview({
  organizationId,
}: OrganizationOverviewProps) {
  const [organization, setOrganization] = useState<OrganizationDetail>();
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [error, setError] = useState<string>();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();

  useEffect(() => {
    let isActive = true;

    void Promise.all([
      apiRequest<OrganizationDetail>(`/manage/organizations/${organizationId}`),
      apiRequest<SiteSummary[]>(
        `/manage/organizations/${organizationId}/sites`,
      ),
    ])
      .then(([nextOrganization, nextSites]) => {
        if (!isActive) return;
        setOrganization(nextOrganization);
        setSites(nextSites);
        setError(undefined);
      })
      .catch((nextError: unknown) => {
        if (isActive) {
          setError(
            nextError instanceof Error ? nextError.message : "Unable to load.",
          );
        }
      });

    return () => {
      isActive = false;
    };
  }, [organizationId]);

  async function createSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setCreateError(undefined);
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const site = await apiRequest<SiteSummary>(
        `/manage/organizations/${organizationId}/sites`,
        {
          method: "POST",
          body: JSON.stringify({
            name: formData.get("name"),
            slug: formData.get("slug"),
          }),
        },
      );

      form.reset();
      setShowCreateForm(false);
      setSites((prev) =>
        [...prev, site].sort((a, b) => a.name.localeCompare(b.name)),
      );
    } catch (nextError) {
      setCreateError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to create site.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Organization
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
            {organization?.name ?? "Loading…"}
          </h1>
          {organization && (
            <p className="text-sm text-muted-foreground">{organization.slug}</p>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreateForm((v) => !v)}
          variant={showCreateForm ? "outline" : "default"}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {showCreateForm ? "Cancel" : "New site"}
        </Button>
      </div>

      {error && (
        <p className="mb-6 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Create site form */}
      {showCreateForm && (
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Create a new site</CardTitle>
            <CardDescription>
              Sites belong to this organization. You can switch between them
              from the sidebar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createSite} className="flex flex-col gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="site-name">Site name</Label>
                <Input id="site-name" name="name" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="site-slug">
                  Site slug{" "}
                  <span className="font-normal text-muted-foreground">
                    (lowercase, hyphens only)
                  </span>
                </Label>
                <Input
                  id="site-slug"
                  name="slug"
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  placeholder="my-site"
                  required
                />
              </div>
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isCreating}>
                  {isCreating ? "Creating…" : "Create site"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Sites grid */}
      {sites.length === 0 && !showCreateForm ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <Globe className="mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">
            No sites yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Create your first site to get started.
          </p>
          <Button
            size="sm"
            className="mt-4"
            onClick={() => setShowCreateForm(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New site
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <Link
              key={site.id}
              href={`/dashboard/sites/${site.id}`}
              className="group block rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-card-foreground">
                    {site.name}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {site.slug}
                  </p>
                </div>
                <Badge
                  variant={site.status === "ACTIVE" ? "default" : "secondary"}
                  className="shrink-0 text-[10px]"
                >
                  {site.status}
                </Badge>
              </div>
              <p className="mt-3 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                Open site →
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { Badge } from "@structo/ui/components/badge";
import { Button } from "@structo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@structo/ui/components/card";
import type { ContentTypeSummary, EntrySummary } from "@structo/contracts";
import {
  FileText,
  Layers,
  Plus,
  Send,
  Settings,
  PencilLine,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "../lib/api";

interface SiteDetail {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "ARCHIVED";
  organizationId: string;
}

interface SiteOverviewProps {
  siteId: string;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  PUBLISHED: "default",
  DRAFT: "secondary",
  ARCHIVED: "outline",
};

function itemHref(siteId: string, entry: EntrySummary): string {
  return entry.contentTypeKind === "SINGLE"
    ? `/dashboard/sites/${siteId}/pages/${entry.contentTypeId}`
    : `/dashboard/sites/${siteId}/collections/${entry.contentTypeId}/items/${entry.id}`;
}

export function SiteOverview({ siteId }: SiteOverviewProps) {
  const [site, setSite] = useState<SiteDetail>();
  const [types, setTypes] = useState<ContentTypeSummary[]>([]);
  const [entries, setEntries] = useState<EntrySummary[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void Promise.all([
      apiRequest<SiteDetail>(`/manage/sites/${siteId}`),
      apiRequest<ContentTypeSummary[]>(`/manage/sites/${siteId}/content-types`),
      apiRequest<EntrySummary[]>(`/manage/sites/${siteId}/entries`),
    ])
      .then(([siteData, typeData, entryData]) => {
        setSite(siteData);
        setTypes(typeData);
        setEntries(entryData);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Unable to load dashboard.");
      });
  }, [siteId]);

  const collectionCount = types.filter((t) => t.kind === "COLLECTION").length;
  const pageCount = types.filter((t) => t.kind === "SINGLE").length;
  const publishedCount = entries.filter((e) => e.status === "PUBLISHED").length;
  const draftCount = entries.filter((e) => e.status === "DRAFT").length;
  const recent = entries.slice(0, 5);

  const stats: Array<{
    icon: typeof Layers;
    label: string;
    value: number;
    sub?: string;
    accent: string;
    iconColor: string;
    href: string | null;
  }> = [
    {
      icon: Layers,
      label: "Collections",
      value: collectionCount,
      accent: "border-l-[#245BFF]",
      iconColor: "text-[#245BFF]",
      href: `/dashboard/sites/${siteId}/collections`,
    },
    {
      icon: FileText,
      label: "Pages",
      value: pageCount,
      accent: "border-l-[#5B7CFF]",
      iconColor: "text-[#5B7CFF]",
      href: `/dashboard/sites/${siteId}/pages`,
    },
    {
      icon: PencilLine,
      label: "Items",
      value: entries.length,
      accent: "border-l-[#06163D]",
      iconColor: "text-[#06163D]",
      href: null,
    },
    {
      icon: Send,
      label: "Published",
      value: publishedCount,
      sub: `${draftCount} draft${draftCount !== 1 ? "s" : ""}`,
      accent: "border-l-emerald-500",
      iconColor: "text-emerald-500",
      href: null,
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Dashboard
          </p>
          <div className="mt-0.5 flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {site?.name ?? "Loading…"}
            </h1>
            {site && (
              <Badge
                variant={site.status === "ACTIVE" ? "default" : "secondary"}
              >
                {site.status}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything happening across this site.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/dashboard/sites/${siteId}/pages`}>
              <Plus className="mr-1.5 h-4 w-4" />
              New page
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={`/dashboard/sites/${siteId}/collections`}>
              <Plus className="mr-1.5 h-4 w-4" />
              New collection
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <p className="mb-6 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Stat cards */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ icon: Icon, label, value, sub, accent, iconColor, href }) => {
          const card = (
            <Card className={`h-full border-l-4 ${accent}`}>
              <CardContent className="flex items-center justify-between gap-3 py-5">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">
                    {value}
                  </p>
                  {sub && (
                    <p className="text-[11px] text-muted-foreground">{sub}</p>
                  )}
                </div>
                <Icon className={`h-7 w-7 shrink-0 ${iconColor}`} />
              </CardContent>
            </Card>
          );
          return href ? (
            <Link key={label} href={href} className="block">
              {card}
            </Link>
          ) : (
            <div key={label}>{card}</div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick actions */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button variant="outline" className="justify-start" asChild>
              <Link href={`/dashboard/sites/${siteId}/collections`}>
                <Layers className="mr-2 h-4 w-4" />
                Manage collections
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href={`/dashboard/sites/${siteId}/pages`}>
                <FileText className="mr-2 h-4 w-4" />
                Manage pages
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href={`/dashboard/sites/${siteId}/settings`}>
                <Settings className="mr-2 h-4 w-4" />
                Site settings
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent items */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent items</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <PencilLine className="mb-2 h-7 w-7 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No content yet</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Create a collection or page to start adding content.
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {recent.map((entry) => (
                  <Link
                    key={entry.id}
                    href={itemHref(siteId, entry)}
                    className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-0 transition-colors hover:bg-accent/20 -mx-2 px-2 rounded"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {entry.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {entry.contentTypeName} ·{" "}
                        {new Date(entry.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant={STATUS_VARIANT[entry.status] ?? "secondary"}
                      className="shrink-0 text-[10px]"
                    >
                      {entry.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

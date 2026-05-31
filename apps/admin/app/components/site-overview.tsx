"use client";

import { Badge } from "@structo/ui/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@structo/ui/components/card";
import {
  FileText,
  ImageIcon,
  Layers,
  Settings,
  Users,
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

interface AreaCard {
  icon: typeof Layers;
  title: string;
  description: string;
  href: string | null;
}

const AREAS: AreaCard[] = [
  {
    icon: Layers,
    title: "Collections",
    description: "Repeatable content types — articles, products, services.",
    href: "collections",
  },
  {
    icon: FileText,
    title: "Pages",
    description: "Standalone pages such as home, about and contact.",
    href: "pages",
  },
  {
    icon: Settings,
    title: "Settings",
    description: "Locale, timezone, SEO defaults and branding.",
    href: "settings",
  },
  {
    icon: ImageIcon,
    title: "Media",
    description: "Upload and manage site media.",
    href: null,
  },
  {
    icon: Users,
    title: "Members",
    description: "Invite collaborators to this site.",
    href: null,
  },
];

export function SiteOverview({ siteId }: SiteOverviewProps) {
  const [site, setSite] = useState<SiteDetail>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    void apiRequest<SiteDetail>(`/manage/sites/${siteId}`)
      .then(setSite)
      .catch((nextError: unknown) => {
        setError(
          nextError instanceof Error ? nextError.message : "Unable to load.",
        );
      });
  }, [siteId]);

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Site overview
        </p>
        <div className="mt-0.5 flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {site?.name ?? "Loading…"}
          </h1>
          {site && (
            <Badge variant={site.status === "ACTIVE" ? "default" : "secondary"}>
              {site.status}
            </Badge>
          )}
        </div>
        {site && <p className="text-sm text-muted-foreground">{site.slug}</p>}
      </div>

      {error && (
        <p className="mb-6 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Areas grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {AREAS.map(({ icon: Icon, title, description, href }) => {
          const card = (
            <Card
              className={
                href
                  ? "h-full transition-colors hover:border-primary/40 hover:bg-accent/20"
                  : "h-full border-dashed opacity-60"
              }
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">{title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{description}</p>
                {!href && (
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
                    Coming soon
                  </p>
                )}
              </CardContent>
            </Card>
          );

          return href ? (
            <Link
              key={title}
              href={`/dashboard/sites/${siteId}/${href}`}
              className="block"
            >
              {card}
            </Link>
          ) : (
            <div key={title}>{card}</div>
          );
        })}
      </div>
    </div>
  );
}

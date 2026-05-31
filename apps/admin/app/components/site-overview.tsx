"use client";

import { Badge } from "@structo/ui/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@structo/ui/components/card";
import { FileText, ImageIcon, Settings, Type, Users } from "lucide-react";
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

const UPCOMING = [
  {
    icon: Type,
    title: "Content Types",
    description: "Define the structure of your content.",
    href: "content-types",
  },
  {
    icon: FileText,
    title: "Entries",
    description: "Create and publish content entries.",
    href: "entries",
  },
  {
    icon: ImageIcon,
    title: "Media",
    description: "Upload and manage site media.",
    href: "media",
  },
  {
    icon: Users,
    title: "Members",
    description: "Invite collaborators to this site.",
    href: "members",
  },
  {
    icon: Settings,
    title: "Settings",
    description: "Configure locale, timezone and more.",
    href: "settings",
  },
] as const;

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
        {site && (
          <p className="text-sm text-muted-foreground">{site.slug}</p>
        )}
      </div>

      {error && (
        <p className="mb-6 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Upcoming features grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {UPCOMING.map(({ icon: Icon, title, description }) => (
          <Card
            key={title}
            className="border-dashed opacity-60"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{description}</p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
                Next milestone
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

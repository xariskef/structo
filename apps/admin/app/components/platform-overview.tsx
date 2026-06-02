"use client";

import { Badge } from "@structo/ui/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@structo/ui/components/card";
import type { PlatformOverviewSummary } from "@structo/contracts";
import { Building2, Globe, Loader2, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "../lib/api";
import { formatActivityAction, formatDateTime } from "../lib/format";

export function PlatformOverview() {
  const [data, setData] = useState<PlatformOverviewSummary>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void apiRequest<PlatformOverviewSummary>("/platform/overview")
      .then((overview) => {
        setData(overview);
        setError(undefined);
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error ? reason.message : "Unable to load overview.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading overview…
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (!data) return null;

  const stats = [
    {
      label: "Organizations",
      value: data.counts.organizations,
      icon: Building2,
    },
    { label: "Sites", value: data.counts.sites, icon: Globe },
    { label: "Users", value: data.counts.users, icon: Users },
  ];

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 py-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent activity</CardTitle>
          <Link
            href="/dashboard/platform/activity"
            className="text-sm text-primary hover:underline"
          >
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {data.recentAuditLogs.length === 0 ? (
            <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
              No activity recorded yet
            </div>
          ) : (
            <div className="divide-y divide-border rounded-md border">
              {data.recentAuditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between gap-4 p-3 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">
                      {formatActivityAction(log.action)}
                    </span>
                    <Badge variant="outline" className="font-normal">
                      {log.entityType}
                    </Badge>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {log.actorName ?? log.actorEmail ?? "System"} ·{" "}
                    {formatDateTime(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { Badge } from "@structo/ui/components/badge";
import { Button } from "@structo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@structo/ui/components/card";
import type { AuditLogSummary, PaginatedAuditLogs } from "@structo/contracts";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  ScrollText,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiRequest } from "../lib/api";
import { formatActivityAction, formatDateTime } from "../lib/format";

type ActivityLogProps =
  | { scope: "organization"; organizationId: string }
  | { scope: "site"; siteId: string }
  | { scope: "platform" };

interface SiteOption {
  id: string;
  name: string;
}

const PAGE_SIZE = 20;

export function ActivityLog(props: ActivityLogProps) {
  const [page, setPage] = useState(1);
  const [siteFilter, setSiteFilter] = useState("");
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [result, setResult] = useState<PaginatedAuditLogs>();
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string>();

  const basePath = useMemo(() => {
    switch (props.scope) {
      case "organization":
        return `/manage/organizations/${props.organizationId}/audit-logs`;
      case "site":
        return `/manage/sites/${props.siteId}/audit-logs`;
      case "platform":
        return `/platform/audit-logs`;
    }
  }, [props]);

  // Organization view can narrow to one of its sites.
  const organizationId =
    props.scope === "organization" ? props.organizationId : undefined;

  useEffect(() => {
    if (!organizationId) return;
    void apiRequest<SiteOption[]>(
      `/manage/organizations/${organizationId}/sites`,
    )
      .then(setSites)
      .catch(() => setSites([]));
  }, [organizationId]);

  const load = useCallback(async () => {
    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (siteFilter) query.set("siteId", siteFilter);
    return apiRequest<PaginatedAuditLogs>(`${basePath}?${query.toString()}`);
  }, [basePath, page, siteFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the spinner while the scoped page reloads.
    setLoading(true);
    void load()
      .then((data) => {
        setResult(data);
        setError(undefined);
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error ? reason.message : "Unable to load activity.",
        ),
      )
      .finally(() => setLoading(false));
  }, [load]);

  // Platform-wide clearing is intentionally not offered.
  const canClear = props.scope !== "platform";

  async function clearLog() {
    const message =
      props.scope === "organization"
        ? "This permanently deletes the entire activity log for this organization, including all of its sites. Continue?"
        : "This permanently deletes the activity log for this site. Continue?";
    if (!window.confirm(message)) return;
    setClearing(true);
    setError(undefined);
    try {
      await apiRequest(basePath, { method: "DELETE" });
      setPage(1);
      const query = new URLSearchParams({
        page: "1",
        pageSize: String(PAGE_SIZE),
      });
      if (siteFilter) query.set("siteId", siteFilter);
      const data = await apiRequest<PaginatedAuditLogs>(
        `${basePath}?${query.toString()}`,
      );
      setResult(data);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to clear the activity log.",
      );
    } finally {
      setClearing(false);
    }
  }

  const logs = result?.data ?? [];
  const meta = result?.meta;
  const totalPages = meta?.totalPages ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <ScrollText className="h-4 w-4" />
          Activity
        </CardTitle>
        <div className="flex items-center gap-2">
          {props.scope === "organization" && sites.length > 0 && (
            <select
              aria-label="Filter by site"
              value={siteFilter}
              onChange={(event) => {
                setPage(1);
                setSiteFilter(event.currentTarget.value);
              }}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">All sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          )}
          {canClear && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={clearing || (meta?.total ?? 0) === 0}
              onClick={clearLog}
              className="text-destructive hover:text-destructive"
            >
              {clearing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Clear log
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading activity…
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
            No activity recorded yet
          </div>
        ) : (
          <div className="divide-y divide-border rounded-md border">
            {logs.map((log) => (
              <ActivityRow key={log.id} log={log} />
            ))}
          </div>
        )}

        {meta && totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {meta.page} of {totalPages} · {meta.total} events
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={meta.page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                Previous
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={meta.page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityRow({ log }: { log: AuditLogSummary }) {
  const actor = log.actorName ?? log.actorEmail ?? "System";
  const metadataEntries = readableMetadata(log.metadata);

  return (
    <div className="flex flex-col gap-1 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{formatActivityAction(log.action)}</p>
          <Badge variant="outline" className="font-normal">
            {log.entityType}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          by <span className="text-foreground/70">{actor}</span>
        </p>
        {metadataEntries.length > 0 && (
          <details className="mt-1.5 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">Details</summary>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              {metadataEntries.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="font-medium text-foreground/60">{key}</dt>
                  <dd className="truncate">{value}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </div>
      <p className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        {formatDateTime(log.createdAt)}
      </p>
    </div>
  );
}

// Render only top-level metadata fields, compactly, so the table never becomes
// a raw JSON dump. Nested values collapse to a short JSON string.
function readableMetadata(metadata: unknown): [string, string][] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }
  return Object.entries(metadata as Record<string, unknown>).map(
    ([key, value]) => [
      key,
      value === null || typeof value === "object"
        ? JSON.stringify(value)
        : String(value),
    ],
  );
}

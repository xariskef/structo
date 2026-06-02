"use client";

import { Badge } from "@structo/ui/components/badge";
import { Button } from "@structo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@structo/ui/components/card";
import type { PlatformHealthSummary } from "@structo/contracts";
import { Database, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { apiRequest } from "../lib/api";
import { formatDateTime } from "../lib/format";

export function PlatformHealth() {
  const [data, setData] = useState<PlatformHealthSummary>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(() => {
    setLoading(true);
    return apiRequest<PlatformHealthSummary>("/platform/health")
      .then((health) => {
        setData(health);
        setError(undefined);
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error ? reason.message : "Unable to load health.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() refreshes remote health then updates state.
    void load();
  }, [load]);

  return (
    <div className="grid gap-6">
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" />
            System health
          </CardTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {!data ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking…
            </div>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-2">
              <Field label="Status">
                <Badge
                  variant={data.status === "ok" ? "outline" : "destructive"}
                >
                  {data.status === "ok" ? "Operational" : "Degraded"}
                </Badge>
              </Field>
              <Field label="Database">
                <Badge
                  variant={data.database === "up" ? "outline" : "destructive"}
                >
                  {data.database === "up" ? "Reachable" : "Unreachable"}
                </Badge>
              </Field>
              <Field label="Organizations">
                <span className="tabular-nums">
                  {data.counts.organizations}
                </span>
              </Field>
              <Field label="Sites">
                <span className="tabular-nums">{data.counts.sites}</span>
              </Field>
              <Field label="Users">
                <span className="tabular-nums">{data.counts.users}</span>
              </Field>
              <Field label="Checked">
                <span className="text-sm text-muted-foreground">
                  {formatDateTime(data.checkedAt)}
                </span>
              </Field>
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

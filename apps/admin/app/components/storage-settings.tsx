"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@structo/ui/components/alert";
import { Badge } from "@structo/ui/components/badge";
import { Button } from "@structo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@structo/ui/components/card";
import { Input } from "@structo/ui/components/input";
import { Label } from "@structo/ui/components/label";
import type { SiteStorageStatus } from "@structo/contracts";
import { Check, Cloud, Loader2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { apiRequest } from "../lib/api";

export function StorageSettings({ siteId }: { siteId: string }) {
  const [status, setStatus] = useState<SiteStorageStatus>();
  const [accountId, setAccountId] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [bucket, setBucket] = useState("");
  const [publicBaseUrl, setPublicBaseUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  function apply(next: SiteStorageStatus) {
    setStatus(next);
    setAccountId(next.accountId ?? "");
    setAccessKeyId(next.accessKeyId ?? "");
    setBucket(next.bucket ?? "");
    setPublicBaseUrl(next.publicBaseUrl ?? "");
    setSecretAccessKey("");
  }

  useEffect(() => {
    void apiRequest<SiteStorageStatus>(`/manage/sites/${siteId}/storage`)
      .then(apply)
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load storage settings.",
        ),
      )
      .finally(() => setLoading(false));
  }, [siteId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    setSaved(false);
    try {
      const next = await apiRequest<SiteStorageStatus>(
        `/manage/sites/${siteId}/storage`,
        {
          method: "PUT",
          body: JSON.stringify({
            provider: "r2",
            accountId,
            accessKeyId,
            bucket,
            publicBaseUrl,
            ...(secretAccessKey ? { secretAccessKey } : {}),
          }),
        },
      );
      apply(next);
      setSaved(true);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error ? reason.message : "Unable to save storage.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function useDefault() {
    if (
      !window.confirm(
        "Remove this site's storage configuration and fall back to the platform default?",
      )
    )
      return;
    setBusy(true);
    setError(undefined);
    setSaved(false);
    try {
      const next = await apiRequest<SiteStorageStatus>(
        `/manage/sites/${siteId}/storage`,
        { method: "DELETE" },
      );
      apply(next);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to clear storage settings.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading storage settings…
      </div>
    );
  }

  return (
    <div className="grid max-w-2xl gap-6">
      {status && <StatusBanner status={status} />}

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p className="flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          <Check className="h-4 w-4" />
          Storage verified and saved.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cloud className="h-4 w-4" />
            Cloudflare R2
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={save}>
            <div className="grid gap-1.5">
              <Label htmlFor="r2-account">Account ID</Label>
              <Input
                id="r2-account"
                value={accountId}
                required
                onChange={(event) => setAccountId(event.currentTarget.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="r2-bucket">Bucket</Label>
              <Input
                id="r2-bucket"
                value={bucket}
                required
                placeholder="my-site-media"
                onChange={(event) => setBucket(event.currentTarget.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="r2-access-key">Access Key ID</Label>
              <Input
                id="r2-access-key"
                value={accessKeyId}
                required
                onChange={(event) => setAccessKeyId(event.currentTarget.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="r2-secret">Secret Access Key</Label>
              <Input
                id="r2-secret"
                type="password"
                value={secretAccessKey}
                required={!status?.secretSet}
                placeholder={
                  status?.secretSet
                    ? "•••••••• (leave blank to keep)"
                    : "Secret access key"
                }
                onChange={(event) =>
                  setSecretAccessKey(event.currentTarget.value)
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="r2-public-url">Public base URL</Label>
              <Input
                id="r2-public-url"
                type="url"
                value={publicBaseUrl}
                required
                placeholder="https://pub-xxxx.r2.dev"
                onChange={(event) =>
                  setPublicBaseUrl(event.currentTarget.value)
                }
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : null}
                {busy ? "Verifying…" : "Verify & save"}
              </Button>
              {status?.configured && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={useDefault}
                >
                  Use platform default
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBanner({ status }: { status: SiteStorageStatus }) {
  if (status.configured) {
    return (
      <Alert className="border-primary/30 bg-primary/5">
        <Cloud className="h-4 w-4 text-primary" />
        <AlertTitle className="flex items-center gap-2">
          This site uses its own bucket
          <Badge variant="outline">{status.bucket}</Badge>
        </AlertTitle>
        <AlertDescription>
          Uploaded media is stored in this site&apos;s configured R2 bucket.
        </AlertDescription>
      </Alert>
    );
  }
  if (status.usingFallback) {
    return (
      <Alert>
        <Cloud className="h-4 w-4" />
        <AlertTitle>Using the platform default storage</AlertTitle>
        <AlertDescription>
          Configure a bucket below to store this site&apos;s media separately.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert className="border-destructive/30 bg-destructive/5">
      <Cloud className="h-4 w-4 text-destructive" />
      <AlertTitle>No storage configured</AlertTitle>
      <AlertDescription>
        Media uploads will fail until a bucket is configured here or a platform
        default is set.
      </AlertDescription>
    </Alert>
  );
}

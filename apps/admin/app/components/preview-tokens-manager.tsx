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
import type {
  PreviewTokenCreated,
  PreviewTokenSummary,
} from "@structo/contracts";
import {
  Check,
  Clipboard,
  Eye,
  Loader2,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { apiRequest } from "../lib/api";

interface PreviewTokensManagerProps {
  siteId: string;
}

export function PreviewTokensManager({ siteId }: PreviewTokensManagerProps) {
  const [tokens, setTokens] = useState<PreviewTokenSummary[]>([]);
  const [label, setLabel] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [revealedToken, setRevealedToken] = useState<{
    token: string;
    previewUrl: string | null;
  }>();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [previewDateRange] = useState(() => {
    const now = new Date();
    return {
      min: now.toISOString().slice(0, 16),
      max: new Date(now.getTime() + 86_400_000).toISOString().slice(0, 16),
    };
  });

  async function load() {
    const rows = await apiRequest<PreviewTokenSummary[]>(
      `/manage/sites/${siteId}/preview-tokens`,
    );
    setTokens(rows);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- remote loading updates state after its promises resolve.
    void load()
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load preview tokens.",
        ),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- siteId identifies the remote resource to reload.
  }, [siteId]);

  async function createToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    setRevealedToken(undefined);
    try {
      const created = await apiRequest<PreviewTokenCreated>(
        `/manage/sites/${siteId}/preview-tokens`,
        {
          method: "POST",
          body: JSON.stringify({
            label,
            expiresAt: new Date(expiresAt).toISOString(),
          }),
        },
      );
      setTokens((previous) => [created, ...previous]);
      setLabel("");
      setExpiresAt("");
      setRevealedToken({
        token: created.token,
        previewUrl: created.previewUrl,
      });
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to create preview token.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function revoke(token: PreviewTokenSummary) {
    if (!window.confirm(`Revoke "${token.label}"?`)) return;
    setBusy(true);
    setError(undefined);
    try {
      await apiRequest(`/manage/sites/${siteId}/preview-tokens/${token.id}`, {
        method: "DELETE",
      });
      await load();
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to revoke preview token.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyToken() {
    if (!revealedToken) return;
    const text = revealedToken.previewUrl ?? revealedToken.token;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading preview tokens…
      </div>
    );
  }

  const revealedUrl =
    revealedToken !== undefined
      ? (revealedToken.previewUrl ?? revealedToken.token)
      : undefined;

  return (
    <div className="grid gap-6">
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {revealedUrl && (
        <Alert className="border-primary/30 bg-primary/5">
          <ShieldAlert className="h-4 w-4 text-primary" />
          <AlertTitle>Copy this preview link now</AlertTitle>
          <AlertDescription>
            It is shown only once. Anyone with this URL can view the draft
            content until the token expires or is revoked.
          </AlertDescription>
          <div className="col-span-full mt-3 flex gap-2">
            <Input
              aria-label="Preview URL"
              value={revealedUrl}
              readOnly
              className="font-mono text-xs"
            />
            <Button type="button" variant="outline" onClick={copyToken}>
              {copied ? (
                <Check className="mr-1.5 h-4 w-4" />
              ) : (
                <Clipboard className="mr-1.5 h-4 w-4" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Token list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Issued preview tokens</CardTitle>
          </CardHeader>
          <CardContent>
            {tokens.length === 0 ? (
              <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
                No preview tokens yet
              </div>
            ) : (
              <div className="divide-y divide-border rounded-md border">
                {tokens.map((token) => {
                  const isExpired =
                    !token.revokedAt && new Date(token.expiresAt) < new Date();
                  const status = token.revokedAt
                    ? "Revoked"
                    : isExpired
                      ? "Expired"
                      : "Active";
                  const variant =
                    status === "Active"
                      ? "outline"
                      : status === "Expired"
                        ? "secondary"
                        : "destructive";

                  return (
                    <div
                      key={token.id}
                      className="flex items-start justify-between gap-4 p-4"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{token.label}</p>
                          <Badge variant={variant}>{status}</Badge>
                          {token.entryId && (
                            <Badge
                              variant="outline"
                              className="font-mono text-[10px]"
                            >
                              entry-scoped
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Expires {new Date(token.expiresAt).toLocaleString()}
                        </p>
                        {token.entryId && (
                          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                            {token.entryId}
                          </p>
                        )}
                      </div>

                      {!token.revokedAt && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => void revoke(token)}
                          disabled={busy}
                          aria-label="Revoke token"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4" />
              New site preview token
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void createToken(e)} className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="pt-label">Label</Label>
                <Input
                  id="pt-label"
                  value={label}
                  onChange={(e) => setLabel(e.currentTarget.value)}
                  placeholder="e.g. Agency review"
                  required
                  minLength={1}
                  maxLength={100}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="pt-expires">Expires</Label>
                <input
                  id="pt-expires"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.currentTarget.value)}
                  required
                  min={previewDateRange.min}
                  max={previewDateRange.max}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <Button type="submit" disabled={busy || !label || !expiresAt}>
                {busy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="mr-1.5 h-4 w-4" />
                )}
                {busy ? "Generating…" : "Generate preview link"}
              </Button>

              <p className="text-xs text-muted-foreground">
                A site-scoped token grants draft-read access to any entry on
                this site. Use entry-scoped tokens from the entry editor for
                tighter control. Tokens expire within 24 hours.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

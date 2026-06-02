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
  SiteApiTokenCreated,
  SiteApiTokenSummary,
} from "@structo/contracts";
import {
  Check,
  Clipboard,
  KeyRound,
  Loader2,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { apiRequest } from "../lib/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api/v1";

interface SiteDetail {
  key: string;
}

export function ApiTokensManager({ siteId }: { siteId: string }) {
  const [tokens, setTokens] = useState<SiteApiTokenSummary[]>([]);
  const [siteKey, setSiteKey] = useState("");
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [revealedToken, setRevealedToken] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function load() {
    const [site, tokenRows] = await Promise.all([
      apiRequest<SiteDetail>(`/manage/sites/${siteId}`),
      apiRequest<SiteApiTokenSummary[]>(`/manage/sites/${siteId}/api-tokens`),
    ]);
    setSiteKey(site.key);
    setTokens(tokenRows);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- remote loading updates state after its promises resolve.
    void load()
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load API tokens.",
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
      const created = await apiRequest<SiteApiTokenCreated>(
        `/manage/sites/${siteId}/api-tokens`,
        {
          method: "POST",
          body: JSON.stringify({
            name,
            ...(expiresAt
              ? { expiresAt: new Date(expiresAt).toISOString() }
              : {}),
          }),
        },
      );
      setTokens((previous) => [created, ...previous]);
      setName("");
      setExpiresAt("");
      setRevealedToken(created.token);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to create API token.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function revoke(token: SiteApiTokenSummary) {
    if (!window.confirm(`Revoke ${token.name}?`)) return;
    setBusy(true);
    setError(undefined);
    try {
      await apiRequest(`/manage/sites/${siteId}/api-tokens/${token.id}`, {
        method: "DELETE",
      });
      await load();
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to revoke API token.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyToken() {
    if (!revealedToken) return;
    await navigator.clipboard.writeText(revealedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading API tokens…
      </div>
    );
  }

  const deliveryBaseUrl = `${API_BASE_URL}/delivery/sites/${siteKey}`;

  return (
    <div className="grid gap-6">
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {revealedToken && (
        <Alert className="border-primary/30 bg-primary/5">
          <ShieldAlert className="h-4 w-4 text-primary" />
          <AlertTitle>Copy this token now</AlertTitle>
          <AlertDescription>
            It is shown only once. Store it in the frontend project&apos;s
            secrets, never in source control.
          </AlertDescription>
          <div className="col-span-full mt-3 flex gap-2">
            <Input
              aria-label="New API token"
              value={revealedToken}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery endpoint</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            External frontends use a Bearer token and start from this site-bound
            URL.
          </p>
          <code className="mt-3 block overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs">
            {deliveryBaseUrl}
          </code>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Issued tokens</CardTitle>
          </CardHeader>
          <CardContent>
            {tokens.length === 0 ? (
              <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
                No API tokens yet
              </div>
            ) : (
              <div className="divide-y divide-border rounded-md border">
                {tokens.map((token) => (
                  <div
                    key={token.id}
                    className="flex items-start justify-between gap-4 p-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{token.name}</p>
                        <Badge
                          variant={token.revokedAt ? "destructive" : "outline"}
                        >
                          {token.revokedAt ? "Revoked" : "Active"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Scope: {token.scopes.join(", ")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Created {formatDate(token.createdAt)}
                        {token.lastUsedAt
                          ? ` · Last used ${formatDate(token.lastUsedAt)}`
                          : ""}
                        {token.expiresAt
                          ? ` · Expires ${formatDate(token.expiresAt)}`
                          : ""}
                      </p>
                    </div>
                    {!token.revokedAt && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => revoke(token)}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Revoke
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4" />
              New API token
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={createToken}>
              <div className="grid gap-1.5">
                <Label htmlFor="token-name">Name</Label>
                <Input
                  id="token-name"
                  value={name}
                  required
                  maxLength={100}
                  placeholder="Production frontend"
                  onChange={(event) => setName(event.currentTarget.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="token-expiry">Expiry (optional)</Label>
                <Input
                  id="token-expiry"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.currentTarget.value)}
                />
              </div>
              <Button type="submit" size="sm" disabled={busy}>
                <Plus className="mr-1.5 h-4 w-4" />
                {busy ? "Creating…" : "Create token"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

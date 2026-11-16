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
import { Checkbox } from "@structo/ui/components/checkbox";
import { Input } from "@structo/ui/components/input";
import { Label } from "@structo/ui/components/label";
import {
  WEBHOOK_EVENTS,
  type WebhookCreated,
  type WebhookEvent,
  type WebhookSummary,
} from "@structo/contracts";
import {
  CheckCircle2,
  Clipboard,
  FlaskConical,
  Loader2,
  ShieldAlert,
  Trash2,
  XCircle,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { apiRequest } from "../lib/api";

const EVENT_LABELS: Record<WebhookEvent, string> = {
  "entry.published": "Entry Published",
  "entry.unpublished": "Entry Unpublished",
  "entry.deleted": "Entry Deleted",
  "entry.scheduled": "Entry Scheduled",
};

interface WebhooksManagerProps {
  siteId: string;
}

export function WebhooksManager({ siteId }: WebhooksManagerProps) {
  const [webhooks, setWebhooks] = useState<WebhookSummary[]>([]);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<Set<WebhookEvent>>(
    new Set(),
  );
  const [newSecret, setNewSecret] = useState<string>();
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testingId, setTestingId] = useState<string>();
  const [error, setError] = useState<string>();

  async function load() {
    const rows = await apiRequest<WebhookSummary[]>(
      `/manage/sites/${siteId}/webhooks`,
    );
    setWebhooks(rows);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- remote loading updates state after its promises resolve.
    void load()
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error ? reason.message : "Unable to load webhooks.",
        ),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- siteId identifies the remote resource to reload.
  }, [siteId]);

  function toggleEvent(event: WebhookEvent) {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) {
        next.delete(event);
      } else {
        next.add(event);
      }
      return next;
    });
  }

  async function createWebhook(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selectedEvents.size === 0) {
      setError("Select at least one event.");
      return;
    }
    setBusy(true);
    setError(undefined);
    setNewSecret(undefined);
    try {
      const created = await apiRequest<WebhookCreated>(
        `/manage/sites/${siteId}/webhooks`,
        {
          method: "POST",
          body: JSON.stringify({
            label,
            url,
            events: Array.from(selectedEvents),
          }),
        },
      );
      setWebhooks((prev) => [created, ...prev]);
      setLabel("");
      setUrl("");
      setSelectedEvents(new Set());
      setNewSecret(created.secret);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error ? reason.message : "Unable to create webhook.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(hook: WebhookSummary) {
    setError(undefined);
    try {
      const updated = await apiRequest<WebhookSummary>(
        `/manage/sites/${siteId}/webhooks/${hook.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ enabled: !hook.enabled }),
        },
      );
      setWebhooks((prev) => prev.map((w) => (w.id === hook.id ? updated : w)));
    } catch (reason: unknown) {
      setError(
        reason instanceof Error ? reason.message : "Unable to update webhook.",
      );
    }
  }

  async function deleteWebhook(hook: WebhookSummary) {
    if (!window.confirm(`Delete webhook "${hook.label}"?`)) return;
    setError(undefined);
    try {
      await apiRequest(`/manage/sites/${siteId}/webhooks/${hook.id}`, {
        method: "DELETE",
      });
      setWebhooks((prev) => prev.filter((w) => w.id !== hook.id));
      if (newSecret) setNewSecret(undefined);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error ? reason.message : "Unable to delete webhook.",
      );
    }
  }

  async function sendTestPing(hook: WebhookSummary) {
    setTestingId(hook.id);
    setError(undefined);
    try {
      await apiRequest(`/manage/sites/${siteId}/webhooks/${hook.id}/test`, {
        method: "POST",
      });
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Test ping failed.");
    } finally {
      setTestingId(undefined);
    }
  }

  async function copySecret() {
    if (!newSecret) return;
    await navigator.clipboard.writeText(newSecret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading webhooks…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* One-time secret banner */}
      {newSecret && (
        <Alert className="border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-100">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Save your signing secret now</AlertTitle>
          <AlertDescription className="space-y-2">
            <p className="text-sm">
              This secret will not be shown again. Copy it and store it
              securely.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-amber-100 px-2 py-1 text-xs dark:bg-amber-900">
                {newSecret}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void copySecret()}
              >
                {copiedSecret ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Clipboard className="h-4 w-4" />
                )}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Create form */}
      <Card>
        <CardHeader>
          <CardTitle>Add Webhook</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void createWebhook(e)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="wh-label">Label</Label>
                <Input
                  id="wh-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="My webhook"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wh-url">URL (HTTPS)</Label>
                <Input
                  id="wh-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/hooks/structo"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Events</Label>
              <div className="flex flex-wrap gap-4">
                {WEBHOOK_EVENTS.map((event) => (
                  <div key={event} className="flex items-center gap-2">
                    <Checkbox
                      id={`ev-${event}`}
                      checked={selectedEvents.has(event)}
                      onCheckedChange={() => toggleEvent(event)}
                    />
                    <Label htmlFor={`ev-${event}`} className="font-normal">
                      {EVENT_LABELS[event]}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Webhook
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      {webhooks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No webhooks yet. Add one above.
        </p>
      ) : (
        <div className="space-y-3">
          {webhooks.map((hook) => (
            <Card key={hook.id}>
              <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{hook.label}</span>
                    {hook.enabled ? (
                      <Badge variant="secondary" className="text-xs">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Disabled
                      </Badge>
                    )}
                    {hook.lastDeliveryOk === true && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    )}
                    {hook.lastDeliveryOk === false && (
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {hook.url}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {hook.events.map((ev) => (
                      <Badge key={ev} variant="outline" className="text-xs">
                        {EVENT_LABELS[ev]}
                      </Badge>
                    ))}
                  </div>
                  {hook.lastTriggeredAt && (
                    <p className="text-xs text-muted-foreground">
                      Last triggered:{" "}
                      {new Date(hook.lastTriggeredAt).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void sendTestPing(hook)}
                    disabled={testingId === hook.id}
                    title="Send test ping"
                  >
                    {testingId === hook.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FlaskConical className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant={hook.enabled ? "outline" : "secondary"}
                    onClick={() => void toggleEnabled(hook)}
                    title={hook.enabled ? "Disable" : "Enable"}
                  >
                    {hook.enabled ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => void deleteWebhook(hook)}
                    title="Delete webhook"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

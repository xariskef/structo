"use client";

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
import type { ContentTypeSummary, EntrySummary } from "@structo/contracts";
import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { apiRequest } from "../lib/api";

interface EntriesListProps {
  siteId: string;
  contentTypeId?: string;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  PUBLISHED: "default",
  DRAFT: "secondary",
  ARCHIVED: "outline",
};

function labelToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function EntriesList({ siteId, contentTypeId }: EntriesListProps) {
  const router = useRouter();
  const [entries, setEntries] = useState<EntrySummary[]>([]);
  const [contentTypes, setContentTypes] = useState<ContentTypeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const [selectedCtId, setSelectedCtId] = useState(contentTypeId ?? "");

  useEffect(() => {
    const qs = contentTypeId ? `?contentTypeId=${contentTypeId}` : "";
    void Promise.all([
      apiRequest<EntrySummary[]>(`/manage/sites/${siteId}/entries${qs}`),
      apiRequest<ContentTypeSummary[]>(`/manage/sites/${siteId}/content-types`),
    ])
      .then(([e, cts]) => {
        setEntries(e);
        // Only show ACTIVE content types for entry creation
        setContentTypes(cts.filter((ct) => ct.status === "ACTIVE"));
      })
      .finally(() => setLoading(false));
  }, [siteId, contentTypeId]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setCreateError(undefined);
    const data = new FormData(event.currentTarget);

    try {
      const entry = await apiRequest<EntrySummary>(
        `/manage/sites/${siteId}/entries`,
        {
          method: "POST",
          body: JSON.stringify({
            contentTypeId: data.get("contentTypeId"),
            title: data.get("title"),
            slug: data.get("slug"),
            data: {},
          }),
        },
      );

      router.push(`/dashboard/sites/${siteId}/entries/${entry.id}`);
    } catch (e: unknown) {
      setCreateError(
        e instanceof Error ? e.message : "Unable to create entry.",
      );
      setIsCreating(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Content
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
            Entries
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and manage content for this site.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreate((v) => !v)}
          disabled={contentTypes.length === 0}
          title={contentTypes.length === 0 ? "Activate a content type first" : undefined}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {showCreate ? "Cancel" : "New entry"}
        </Button>
      </div>

      {/* No active content types warning */}
      {contentTypes.length === 0 && !loading && (
        <div className="mb-6 rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
          You need at least one{" "}
          <Link
            href={`/dashboard/sites/${siteId}/content-types`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            active content type
          </Link>{" "}
          before creating entries.
        </div>
      )}

      {/* Create form */}
      {showCreate && contentTypes.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">New entry</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="ct-select">Content type</Label>
                <select
                  id="ct-select"
                  name="contentTypeId"
                  value={selectedCtId}
                  onChange={(e) => setSelectedCtId(e.currentTarget.value)}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select content type…</option>
                  {contentTypes.map((ct) => (
                    <option key={ct.id} value={ct.id}>
                      {ct.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="entry-title">Title</Label>
                <Input
                  id="entry-title"
                  name="title"
                  required
                  onChange={(e) => {
                    const slugInput =
                      e.currentTarget.form?.querySelector<HTMLInputElement>(
                        '[name="slug"]',
                      );
                    if (slugInput && !slugInput.dataset.edited) {
                      slugInput.value = labelToSlug(e.currentTarget.value);
                    }
                  }}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="entry-slug">
                  Slug{" "}
                  <span className="font-normal text-muted-foreground">
                    (auto-derived)
                  </span>
                </Label>
                <Input
                  id="entry-slug"
                  name="slug"
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  required
                  onInput={(e) => {
                    e.currentTarget.dataset.edited = "1";
                  }}
                />
              </div>
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
              <div>
                <Button type="submit" size="sm" disabled={isCreating}>
                  {isCreating ? "Creating…" : "Create entry"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Entry list */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : entries.length === 0 && !showCreate ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <FileText className="mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            No entries yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Create your first entry to start adding content.
          </p>
          {contentTypes.length > 0 && (
            <Button
              size="sm"
              className="mt-4"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New entry
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <Link
              key={entry.id}
              href={`/dashboard/sites/${siteId}/entries/${entry.id}`}
              className="group flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4 transition-colors hover:border-primary/40 hover:bg-accent/20"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-card-foreground">
                    {entry.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.contentTypeName} · {entry.slug}
                  </p>
                </div>
              </div>
              <Badge
                variant={STATUS_VARIANT[entry.status] ?? "secondary"}
                className="ml-4 shrink-0 text-[10px]"
              >
                {entry.status}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

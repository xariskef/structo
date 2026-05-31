"use client";

import { Badge } from "@structo/ui/components/badge";
import { Button } from "@structo/ui/components/button";
import { Input } from "@structo/ui/components/input";
import { Label } from "@structo/ui/components/label";
import { Separator } from "@structo/ui/components/separator";
import type { ContentTypeDetail, EntryDetail, RevisionSummary } from "@structo/contracts";
import type { FieldDefinition } from "@structo/field-kit";
import {
  CheckCircle2,
  Clock,
  EyeOff,
  Loader2,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "../lib/api";
import { FieldRenderer } from "./entry-field-renderer";

interface EntryEditorProps {
  siteId: string;
  entryId: string;
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

export function EntryEditor({ siteId, entryId }: EntryEditorProps) {
  const [entry, setEntry] = useState<EntryDetail | null>(null);
  const [contentType, setContentType] = useState<ContentTypeDetail | null>(null);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void apiRequest<EntryDetail>(
      `/manage/sites/${siteId}/entries/${entryId}`,
    ).then(async (e) => {
      setEntry(e);
      setTitle(e.title);
      setSlug(e.slug);
      setData(e.data);

      // Load content type for field schema
      const ct = await apiRequest<ContentTypeDetail>(
        `/manage/sites/${siteId}/content-types/${e.contentTypeId}`,
      );
      setContentType(ct);

      // Load revisions
      const revs = await apiRequest<RevisionSummary[]>(
        `/manage/sites/${siteId}/entries/${entryId}/revisions`,
      );
      setRevisions(revs);
    });
  }, [siteId, entryId]);

  function handleTitleChange(newTitle: string) {
    setTitle(newTitle);
    if (!slugEdited) {
      setSlug(labelToSlug(newTitle));
    }
  }

  async function save() {
    setIsSaving(true);
    setError(undefined);
    try {
      const updated = await apiRequest<EntryDetail>(
        `/manage/sites/${siteId}/entries/${entryId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ title, slug, data }),
        },
      );
      setEntry(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setIsSaving(false);
    }
  }

  async function publish() {
    setIsPublishing(true);
    setError(undefined);
    try {
      // Save first, then publish
      await apiRequest(`/manage/sites/${siteId}/entries/${entryId}`, {
        method: "PATCH",
        body: JSON.stringify({ title, slug, data }),
      });
      const updated = await apiRequest<EntryDetail>(
        `/manage/sites/${siteId}/entries/${entryId}/publish`,
        { method: "POST" },
      );
      setEntry(updated);
      const revs = await apiRequest<RevisionSummary[]>(
        `/manage/sites/${siteId}/entries/${entryId}/revisions`,
      );
      setRevisions(revs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to publish.");
    } finally {
      setIsPublishing(false);
    }
  }

  async function unpublish() {
    setIsUnpublishing(true);
    setError(undefined);
    try {
      const updated = await apiRequest<EntryDetail>(
        `/manage/sites/${siteId}/entries/${entryId}/unpublish`,
        { method: "POST" },
      );
      setEntry(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to unpublish.");
    } finally {
      setIsUnpublishing(false);
    }
  }

  if (!entry || !contentType) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  const fields = contentType.fields as FieldDefinition[];
  const isArchived = entry.status === "ARCHIVED";

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <Link
              href={`/dashboard/sites/${siteId}/entries`}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Entries
            </Link>
            <span className="text-[11px] text-muted-foreground">/</span>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {contentType.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {entry.title}
            </h1>
            <Badge
              variant={STATUS_VARIANT[entry.status] ?? "secondary"}
              className="text-[10px]"
            >
              {entry.status}
            </Badge>
          </div>
          {entry.latestRevision !== null && (
            <p className="text-sm text-muted-foreground">
              v{entry.latestRevision}
            </p>
          )}
        </div>

        {!isArchived && (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={save}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save draft
            </Button>
            {entry.status === "PUBLISHED" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={unpublish}
                disabled={isUnpublishing}
              >
                <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                {isUnpublishing ? "Unpublishing…" : "Unpublish"}
              </Button>
            ) : (
              <Button size="sm" onClick={publish} disabled={isPublishing}>
                <Send className="mr-1.5 h-3.5 w-3.5" />
                {isPublishing ? "Publishing…" : "Publish"}
              </Button>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {saved && (
        <p className="mb-4 flex items-center gap-1.5 text-sm text-primary">
          <CheckCircle2 className="h-4 w-4" />
          Saved
        </p>
      )}

      {/* System fields */}
      <div className="mb-6 flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
        <div className="grid gap-1.5">
          <Label htmlFor="entry-title">Title</Label>
          <Input
            id="entry-title"
            value={title}
            onChange={(e) => handleTitleChange(e.currentTarget.value)}
            disabled={isArchived}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="entry-slug">Slug</Label>
          <Input
            id="entry-slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.currentTarget.value);
              setSlugEdited(true);
            }}
            disabled={isArchived}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            className="font-mono"
          />
        </div>
      </div>

      {/* Dynamic fields */}
      {fields.length > 0 ? (
        <div className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {contentType.name} fields
          </p>
          {fields.map((field) => (
            <FieldRenderer
              key={field.id}
              field={field}
              value={data[field.key]}
              onChange={(v) => setData((prev) => ({ ...prev, [field.key]: v }))}
              disabled={isArchived}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          This content type has no fields yet.
        </div>
      )}

      {/* Revisions */}
      {revisions.length > 0 && (
        <div className="mt-8">
          <Separator className="mb-4" />
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Revision history
          </p>
          <div className="flex flex-col gap-1.5">
            {revisions.map((rev) => (
              <div
                key={rev.id}
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"
              >
                <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="font-mono text-xs text-muted-foreground">
                  v{rev.revision}
                </span>
                <Badge
                  variant={STATUS_VARIANT[rev.status] ?? "secondary"}
                  className="text-[10px]"
                >
                  {rev.status}
                </Badge>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(rev.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { Button } from "@structo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@structo/ui/components/card";
import { Input } from "@structo/ui/components/input";
import { Label } from "@structo/ui/components/label";
import { Separator } from "@structo/ui/components/separator";
import { Textarea } from "@structo/ui/components/textarea";
import type {
  EntryDetail,
  RevisionSummary,
  SiteSettings,
} from "@structo/contracts";
import type { FieldDefinition } from "@structo/field-kit";
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  EyeOff,
  Loader2,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "../lib/api";
import { FieldRenderer } from "./entry-field-renderer";
import { EntryTaxonomies } from "./entry-taxonomies";
import { StatusBadge } from "./status-badge";

interface EntryEditorProps {
  siteId: string;
  entryId: string;
  backHref?: string;
  backLabel?: string;
  expectedContentTypeId?: string;
  allowArchive?: boolean;
}

function labelToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function publicUrl(base: string | null, entry: EntryDetail): string | null {
  if (!base) return null;
  const root = base.replace(/\/$/, "");
  return entry.contentTypeKind === "SINGLE"
    ? `${root}/${entry.slug}`
    : `${root}/${entry.contentTypeSlug}/${entry.slug}`;
}

function toDateTimeLocal(value: Date | string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function EntryEditor({
  siteId,
  entryId,
  backHref,
  backLabel,
  expectedContentTypeId,
  allowArchive = true,
}: EntryEditorProps) {
  const [entry, setEntry] = useState<EntryDetail | null>(null);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [publicBaseUrl, setPublicBaseUrl] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [busy, setBusy] = useState<
    null | "save" | "publish" | "unpublish" | "archive" | "schedule"
  >(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();

  function applyEntry(e: EntryDetail) {
    setEntry(e);
    setTitle(e.title);
    setSlug(e.slug);
    setData(e.data);
    setExcerpt(e.excerpt ?? "");
    setSeoTitle(e.seoTitle ?? "");
    setSeoDescription(e.seoDescription ?? "");
    setScheduleAt(
      e.status === "SCHEDULED" && e.publishedAt
        ? toDateTimeLocal(e.publishedAt)
        : "",
    );
  }

  useEffect(() => {
    void apiRequest<EntryDetail>(`/manage/sites/${siteId}/entries/${entryId}`)
      .then(async (e) => {
        if (
          expectedContentTypeId !== undefined &&
          e.contentTypeId !== expectedContentTypeId
        ) {
          setError("This item does not belong to the selected collection.");
          return;
        }
        setError(undefined);
        applyEntry(e);
        const [revs, settings] = await Promise.all([
          apiRequest<RevisionSummary[]>(
            `/manage/sites/${siteId}/entries/${entryId}/revisions`,
          ),
          apiRequest<SiteSettings>(`/manage/sites/${siteId}/settings`).catch(
            () => null,
          ),
        ]);
        setRevisions(revs);
        setPublicBaseUrl(settings?.publicBaseUrl ?? null);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Unable to load content.");
      });
  }, [siteId, entryId, expectedContentTypeId]);

  function handleTitleChange(newTitle: string) {
    setTitle(newTitle);
    if (!slugEdited) setSlug(labelToSlug(newTitle));
  }

  function entryBody() {
    return JSON.stringify({
      title,
      slug,
      data,
      excerpt,
      seoTitle,
      seoDescription,
    });
  }

  async function persist(): Promise<EntryDetail> {
    return apiRequest<EntryDetail>(
      `/manage/sites/${siteId}/entries/${entryId}`,
      { method: "PATCH", body: entryBody() },
    );
  }

  async function refreshRevisions() {
    const revs = await apiRequest<RevisionSummary[]>(
      `/manage/sites/${siteId}/entries/${entryId}/revisions`,
    );
    setRevisions(revs);
  }

  async function save() {
    setBusy("save");
    setError(undefined);
    try {
      applyEntry(await persist());
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    setBusy("publish");
    setError(undefined);
    try {
      await persist();
      const updated = await apiRequest<EntryDetail>(
        `/manage/sites/${siteId}/entries/${entryId}/publish`,
        { method: "POST" },
      );
      applyEntry(updated);
      await refreshRevisions();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to publish.");
    } finally {
      setBusy(null);
    }
  }

  async function unpublish() {
    setBusy("unpublish");
    setError(undefined);
    try {
      const updated = await apiRequest<EntryDetail>(
        `/manage/sites/${siteId}/entries/${entryId}/unpublish`,
        { method: "POST" },
      );
      applyEntry(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to unpublish.");
    } finally {
      setBusy(null);
    }
  }

  async function archive() {
    setBusy("archive");
    setError(undefined);
    try {
      const updated = await apiRequest<EntryDetail>(
        `/manage/sites/${siteId}/entries/${entryId}/archive`,
        { method: "POST" },
      );
      applyEntry(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to archive.");
    } finally {
      setBusy(null);
    }
  }

  async function schedule() {
    if (!scheduleAt) return;
    setBusy("schedule");
    setError(undefined);
    try {
      await persist();
      const publishAt = new Date(scheduleAt).toISOString();
      const updated = await apiRequest<EntryDetail>(
        `/manage/sites/${siteId}/entries/${entryId}/schedule`,
        { method: "POST", body: JSON.stringify({ publishAt }) },
      );
      applyEntry(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to schedule.");
    } finally {
      setBusy(null);
    }
  }

  if (error && !entry) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (!entry) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  const fields = entry.fields as FieldDefinition[];
  const isArchived = entry.status === "ARCHIVED";
  const viewUrl =
    entry.status === "PUBLISHED" ? publicUrl(publicBaseUrl, entry) : null;

  return (
    <div>
      {backHref && (
        <div className="mb-4 flex items-center gap-1.5">
          <Link
            href={backHref}
            className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {backLabel ?? entry.contentTypeName}
          </Link>
          <span className="text-[11px] text-muted-foreground">/</span>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {entry.title}
          </span>
        </div>
      )}

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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
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

          {fields.length > 0 ? (
            <div className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5">
              {fields.map((field) => (
                <FieldRenderer
                  key={field.id}
                  field={field}
                  value={data[field.key]}
                  onChange={(v) =>
                    setData((prev) => ({ ...prev, [field.key]: v }))
                  }
                  disabled={isArchived}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              This content type has no fields yet.
            </div>
          )}

          {revisions.length > 0 && (
            <div>
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
                    <StatusBadge status={rev.status} />
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(rev.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          {/* Publish card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm">
                Publish
                <StatusBadge status={entry.status} />
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {entry.status === "SCHEDULED" && entry.publishedAt && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Goes live {new Date(entry.publishedAt).toLocaleString()}
                </p>
              )}
              {entry.latestRevision !== null && (
                <p className="text-xs text-muted-foreground">
                  Published version v{entry.latestRevision}
                </p>
              )}
              {viewUrl && (
                <a
                  href={viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View on site
                </a>
              )}

              {!isArchived && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={save}
                    disabled={busy !== null}
                  >
                    {busy === "save" && (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    )}
                    {entry.status === "DRAFT" ? "Save draft" : "Save changes"}
                  </Button>

                  {entry.status === "PUBLISHED" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={unpublish}
                      disabled={busy !== null}
                    >
                      <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                      {busy === "unpublish" ? "Unpublishing…" : "Unpublish"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={publish}
                      disabled={busy !== null}
                    >
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      {busy === "publish" ? "Publishing…" : "Publish now"}
                    </Button>
                  )}

                  {/* Schedule */}
                  <div className="grid gap-1.5 rounded-md border border-border p-2.5">
                    <Label
                      htmlFor="schedule-at"
                      className="text-[11px] text-muted-foreground"
                    >
                      Schedule for later
                    </Label>
                    <input
                      id="schedule-at"
                      type="datetime-local"
                      value={scheduleAt}
                      onChange={(e) => setScheduleAt(e.currentTarget.value)}
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={schedule}
                      disabled={busy !== null || !scheduleAt}
                    >
                      <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                      {busy === "schedule" ? "Scheduling…" : "Schedule"}
                    </Button>
                  </div>

                  {allowArchive && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={archive}
                      disabled={busy !== null}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Archive className="mr-1.5 h-3.5 w-3.5" />
                      {busy === "archive" ? "Archiving…" : "Archive"}
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <EntryTaxonomies
            siteId={siteId}
            entryId={entryId}
            contentTypeId={entry.contentTypeId}
            disabled={isArchived}
          />

          {/* SEO card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">SEO</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="seo-title" className="flex justify-between">
                  <span>Meta title</span>
                  <span className="font-normal text-muted-foreground">
                    {seoTitle.length}/70
                  </span>
                </Label>
                <Input
                  id="seo-title"
                  value={seoTitle}
                  maxLength={70}
                  disabled={isArchived}
                  onChange={(e) => setSeoTitle(e.currentTarget.value)}
                  placeholder={title}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="seo-desc" className="flex justify-between">
                  <span>Meta description</span>
                  <span className="font-normal text-muted-foreground">
                    {seoDescription.length}/160
                  </span>
                </Label>
                <Textarea
                  id="seo-desc"
                  value={seoDescription}
                  maxLength={160}
                  rows={3}
                  disabled={isArchived}
                  onChange={(e) => setSeoDescription(e.currentTarget.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Excerpt card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm">
                Excerpt
                <span className="text-[11px] font-normal text-muted-foreground">
                  {excerpt.length}/300
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={excerpt}
                maxLength={300}
                rows={4}
                disabled={isArchived}
                onChange={(e) => setExcerpt(e.currentTarget.value)}
                placeholder="A short summary used in lists and search results."
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

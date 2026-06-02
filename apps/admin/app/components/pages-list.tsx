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
import type { ContentTypeSummary } from "@structo/contracts";
import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { apiRequest } from "../lib/api";
import { StatusBadge } from "./status-badge";

interface PagesListProps {
  siteId: string;
}

interface BulkResult {
  affected: number;
  failed: number;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  DRAFT: "secondary",
  ARCHIVED: "outline",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function PagesList({ siteId }: PagesListProps) {
  const router = useRouter();
  const [pages, setPages] = useState<ContentTypeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  function load() {
    return apiRequest<ContentTypeSummary[]>(
      `/manage/sites/${siteId}/content-types?kind=SINGLE`,
    ).then((rows) => {
      setPages(rows);
      setSelected(new Set());
    });
  }

  useEffect(() => {
    void load()
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Unable to load pages."),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulk(action: "publish" | "unpublish" | "archive") {
    if (selected.size === 0) return;
    if (
      action === "archive" &&
      !window.confirm(`Archive ${selected.size} page(s)?`)
    ) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const result = await apiRequest<BulkResult>(
        `/manage/sites/${siteId}/content-types/bulk`,
        {
          method: "POST",
          body: JSON.stringify({ action, ids: [...selected] }),
        },
      );
      await load();
      if (result.failed > 0) {
        setError(
          `${result.affected} page(s) updated. ${result.failed} page(s) could not be updated.`,
        );
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Bulk action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setCreateError(undefined);
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name"));

    try {
      const created = await apiRequest<ContentTypeSummary>(
        `/manage/sites/${siteId}/content-types`,
        {
          method: "POST",
          body: JSON.stringify({
            kind: "SINGLE",
            preset: "page",
            name,
            singularName: name,
            pluralName: name,
            slug: data.get("slug"),
          }),
        },
      );
      router.push(`/dashboard/sites/${siteId}/pages/${created.id}`);
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Unable to create page.");
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
            Pages
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Standalone pages with their own fields — home, about, contact, and
            other one-off layouts.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {showCreate ? "Cancel" : "New page"}
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">New page</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="page-name">
                  Name{" "}
                  <span className="font-normal text-muted-foreground">
                    e.g. About
                  </span>
                </Label>
                <Input
                  id="page-name"
                  name="name"
                  placeholder="About"
                  required
                  onChange={(e) => {
                    const slug =
                      e.currentTarget.form?.querySelector<HTMLInputElement>(
                        '[name="slug"]',
                      );
                    if (slug && !slug.dataset.edited)
                      slug.value = slugify(e.currentTarget.value);
                  }}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="page-slug">
                  Slug{" "}
                  <span className="font-normal text-muted-foreground">
                    (lowercase, hyphens)
                  </span>
                </Label>
                <Input
                  id="page-slug"
                  name="slug"
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  placeholder="about"
                  required
                  onInput={(e) => {
                    e.currentTarget.dataset.edited = "1";
                  }}
                />
              </div>
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
              <Button
                type="submit"
                size="sm"
                disabled={isCreating}
                className="w-fit"
              >
                {isCreating ? "Creating…" : "Create and configure"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {error && (
        <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-accent/30 px-3 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="ml-auto flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => runBulk("publish")}
            >
              Publish
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => runBulk("unpublish")}
            >
              Unpublish
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => runBulk("archive")}
              className="text-destructive hover:text-destructive"
            >
              Archive
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : pages.length === 0 && !showCreate ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <FileText className="mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            No pages yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Create your first page, such as a home or about page.
          </p>
          <Button
            size="sm"
            className="mt-4"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New page
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {pages.map((page) => (
            <div
              key={page.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/20"
            >
              <input
                type="checkbox"
                checked={selected.has(page.id)}
                onChange={() => toggle(page.id)}
                aria-label={`Select ${page.name}`}
                className="h-4 w-4 shrink-0"
              />
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Link
                href={`/dashboard/sites/${siteId}/pages/${page.id}`}
                className="min-w-0 flex-1"
              >
                <p className="truncate font-medium text-card-foreground">
                  {page.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  /{page.slug} · {page.fieldCount} field
                  {page.fieldCount !== 1 ? "s" : ""}
                </p>
              </Link>
              <Badge
                variant={STATUS_VARIANT[page.status] ?? "secondary"}
                className="ml-2 shrink-0 text-[10px]"
              >
                {page.status}
              </Badge>
              {page.singleEntryStatus && (
                <StatusBadge status={page.singleEntryStatus} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

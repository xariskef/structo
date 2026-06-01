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
import type {
  ContentTypeDetail,
  EntrySummary,
  SiteSettings,
} from "@structo/contracts";
import {
  Copy,
  ExternalLink,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { apiRequest } from "../lib/api";
import { StatusBadge } from "./status-badge";

interface CollectionItemsProps {
  siteId: string;
  collection: ContentTypeDetail;
}

interface BulkResult {
  affected: number;
  failed: number;
}

const STATUS_FILTERS = [
  "ALL",
  "DRAFT",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
] as const;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CollectionItems({ siteId, collection }: CollectionItemsProps) {
  const router = useRouter();
  const [items, setItems] = useState<EntrySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTERS)[number]>("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const [error, setError] = useState<string>();
  const [publicBaseUrl, setPublicBaseUrl] = useState<string | null>(null);

  const isActive = collection.status === "ACTIVE";
  const base = `/dashboard/sites/${siteId}/collections/${collection.id}/items`;

  function load() {
    const statusParam = statusFilter === "ALL" ? "" : `&status=${statusFilter}`;
    return apiRequest<EntrySummary[]>(
      `/manage/sites/${siteId}/entries?contentTypeId=${collection.id}${statusParam}`,
    ).then((rows) => {
      setItems(rows);
      setSelected(new Set());
    });
  }

  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    void load()
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Unable to load items.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, collection.id, statusFilter, isActive]);

  useEffect(() => {
    void apiRequest<SiteSettings>(`/manage/sites/${siteId}/settings`)
      .then((s) => setPublicBaseUrl(s.publicBaseUrl ?? null))
      .catch(() => setPublicBaseUrl(null));
  }, [siteId]);

  const filtered = items.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.slug.toLowerCase().includes(q)
    );
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === filtered.length
        ? new Set()
        : new Set(filtered.map((i) => i.id)),
    );
  }

  async function runBulk(
    action: "publish" | "unpublish" | "archive" | "delete",
  ) {
    if (selected.size === 0) return;
    if (
      action === "delete" &&
      !window.confirm(`Delete ${selected.size} item(s)? This cannot be undone.`)
    ) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const result = await apiRequest<BulkResult>(
        `/manage/sites/${siteId}/entries/bulk`,
        {
          method: "POST",
          body: JSON.stringify({ action, entryIds: [...selected] }),
        },
      );
      await load();
      if (result.failed > 0) {
        setError(
          `${result.affected} item(s) updated. ${result.failed} item(s) could not be updated.`,
        );
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Bulk action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function duplicate(id: string) {
    setBusy(true);
    setError(undefined);
    try {
      await apiRequest(`/manage/sites/${siteId}/entries/${id}/duplicate`, {
        method: "POST",
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to duplicate.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this item? This cannot be undone.")) return;
    setBusy(true);
    setError(undefined);
    try {
      await apiRequest(`/manage/sites/${siteId}/entries/${id}`, {
        method: "DELETE",
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to delete.");
    } finally {
      setBusy(false);
    }
  }

  function viewUrl(item: EntrySummary): string | null {
    if (item.status !== "PUBLISHED" || !publicBaseUrl) return null;
    return `${publicBaseUrl.replace(/\/$/, "")}/${item.contentTypeSlug}/${item.slug}`;
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setCreateError(undefined);
    const data = new FormData(event.currentTarget);
    try {
      const created = await apiRequest<EntrySummary>(
        `/manage/sites/${siteId}/entries`,
        {
          method: "POST",
          body: JSON.stringify({
            contentTypeId: collection.id,
            title: data.get("title"),
            slug: data.get("slug"),
            data: {},
          }),
        },
      );
      router.push(`${base}/${created.id}`);
    } catch (e: unknown) {
      setCreateError(
        e instanceof Error
          ? e.message
          : `Unable to create ${collection.singularName}.`,
      );
      setIsCreating(false);
    }
  }

  if (collection.status === "ARCHIVED") {
    return (
      <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
        This collection is archived. Its items are no longer editable.
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
        Activate this collection from the{" "}
        <span className="font-medium text-foreground">Structure</span> tab
        before adding {collection.pluralName.toLowerCase()}.
      </div>
    );
  }

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">
          {collection.pluralName}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({items.length})
          </span>
        </h2>
        <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {showCreate ? "Cancel" : `New ${collection.singularName}`}
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">
              New {collection.singularName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="item-title">Title</Label>
                <Input
                  id="item-title"
                  name="title"
                  required
                  onChange={(e) => {
                    const s =
                      e.currentTarget.form?.querySelector<HTMLInputElement>(
                        '[name="slug"]',
                      );
                    if (s && !s.dataset.edited)
                      s.value = slugify(e.currentTarget.value);
                  }}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="item-slug">
                  Slug{" "}
                  <span className="font-normal text-muted-foreground">
                    (auto-derived)
                  </span>
                </Label>
                <Input
                  id="item-slug"
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
              <Button
                type="submit"
                size="sm"
                disabled={isCreating}
                className="w-fit"
              >
                {isCreating ? "Creating…" : `Create ${collection.singularName}`}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            placeholder={`Search ${collection.pluralName.toLowerCase()}…`}
            className="pl-8"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.currentTarget.value as (typeof STATUS_FILTERS)[number],
            )
          }
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === "ALL"
                ? "All statuses"
                : s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>

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
            >
              Archive
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => runBulk("delete")}
              className="text-destructive hover:text-destructive"
            >
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
          <FileText className="mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            {items.length === 0
              ? `No ${collection.pluralName.toLowerCase()} yet`
              : "No items match your filters"}
          </p>
          {items.length === 0 && (
            <Button
              size="sm"
              className="mt-4"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New {collection.singularName}
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                    className="h-4 w-4"
                  />
                </th>
                <th className="px-3 py-2.5 font-semibold">Title</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold">Updated</th>
                <th className="w-px px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const url = viewUrl(item);
                return (
                  <tr
                    key={item.id}
                    className="border-t border-border transition-colors hover:bg-muted/30"
                  >
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggle(item.id)}
                        aria-label={`Select ${item.title}`}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`${base}/${item.id}`}
                        className="font-medium hover:underline"
                      >
                        {item.title}
                      </Link>
                      {item.excerpt && (
                        <p className="truncate text-xs text-muted-foreground max-w-md">
                          {item.excerpt}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`${base}/${item.id}`}
                          title="Edit"
                          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          type="button"
                          title="Duplicate"
                          disabled={busy}
                          onClick={() => duplicate(item.id)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View on site"
                            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          title="Delete"
                          disabled={busy}
                          onClick={() => remove(item.id)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

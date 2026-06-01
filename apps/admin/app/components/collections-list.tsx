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
import { Layers, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { apiRequest } from "../lib/api";

interface CollectionsListProps {
  siteId: string;
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

function singularGuess(plural: string): string {
  const trimmed = plural.trim();
  if (/ies$/i.test(trimmed)) return trimmed.replace(/ies$/i, "y");
  if (/s$/i.test(trimmed)) return trimmed.replace(/s$/i, "");
  return trimmed;
}

export function CollectionsList({ siteId }: CollectionsListProps) {
  const router = useRouter();
  const [collections, setCollections] = useState<ContentTypeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();

  useEffect(() => {
    void apiRequest<ContentTypeSummary[]>(
      `/manage/sites/${siteId}/content-types?kind=COLLECTION`,
    )
      .then(setCollections)
      .finally(() => setLoading(false));
  }, [siteId]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setCreateError(undefined);
    const data = new FormData(event.currentTarget);

    try {
      const created = await apiRequest<ContentTypeSummary>(
        `/manage/sites/${siteId}/content-types`,
        {
          method: "POST",
          body: JSON.stringify({
            kind: "COLLECTION",
            name: data.get("pluralName"),
            pluralName: data.get("pluralName"),
            singularName: data.get("singularName"),
            slug: data.get("slug"),
          }),
        },
      );
      router.push(`/dashboard/sites/${siteId}/collections/${created.id}`);
    } catch (e: unknown) {
      setCreateError(
        e instanceof Error ? e.message : "Unable to create collection.",
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
            Collections
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reusable content types that hold many items — articles, products,
            services, and more.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {showCreate ? "Cancel" : "New collection"}
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">New collection</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="col-plural">
                  Name (plural){" "}
                  <span className="font-normal text-muted-foreground">
                    e.g. Articles
                  </span>
                </Label>
                <Input
                  id="col-plural"
                  name="pluralName"
                  placeholder="Articles"
                  required
                  onChange={(e) => {
                    const form = e.currentTarget.form;
                    if (!form) return;
                    const value = e.currentTarget.value;
                    const singular = form.querySelector<HTMLInputElement>(
                      '[name="singularName"]',
                    );
                    const slug =
                      form.querySelector<HTMLInputElement>('[name="slug"]');
                    if (singular && !singular.dataset.edited) {
                      singular.value = singularGuess(value);
                    }
                    if (slug && !slug.dataset.edited) {
                      slug.value = slugify(value);
                    }
                  }}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="col-singular">
                  Name (singular){" "}
                  <span className="font-normal text-muted-foreground">
                    e.g. Article — used for the “New …” button
                  </span>
                </Label>
                <Input
                  id="col-singular"
                  name="singularName"
                  placeholder="Article"
                  required
                  onInput={(e) => {
                    e.currentTarget.dataset.edited = "1";
                  }}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="col-slug">
                  Slug{" "}
                  <span className="font-normal text-muted-foreground">
                    (lowercase, hyphens)
                  </span>
                </Label>
                <Input
                  id="col-slug"
                  name="slug"
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  placeholder="articles"
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
                  {isCreating ? "Creating…" : "Create and configure"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : collections.length === 0 && !showCreate ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <Layers className="mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            No collections yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Create your first collection to start modeling repeatable content.
          </p>
          <Button
            size="sm"
            className="mt-4"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New collection
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {collections.map((collection) => (
            <Link
              key={collection.id}
              href={`/dashboard/sites/${siteId}/collections/${collection.id}`}
              className="group flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4 transition-colors hover:border-primary/40 hover:bg-accent/20"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-card-foreground">
                    {collection.pluralName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {collection.slug} · {collection.itemCount} item
                    {collection.itemCount !== 1 ? "s" : ""} ·{" "}
                    {collection.fieldCount} field
                    {collection.fieldCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <Badge
                variant={STATUS_VARIANT[collection.status] ?? "secondary"}
                className="ml-4 shrink-0 text-[10px]"
              >
                {collection.status}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

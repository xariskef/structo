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
import type { ContentTypeDetail, EntrySummary } from "@structo/contracts";
import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { apiRequest } from "../lib/api";

interface CollectionItemsProps {
  siteId: string;
  collection: ContentTypeDetail;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  PUBLISHED: "default",
  DRAFT: "secondary",
  ARCHIVED: "outline",
};

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
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();

  const isActive = collection.status === "ACTIVE";

  useEffect(() => {
    void apiRequest<EntrySummary[]>(
      `/manage/sites/${siteId}/entries?contentTypeId=${collection.id}`,
    )
      .then(setItems)
      .finally(() => setLoading(false));
  }, [siteId, collection.id]);

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
      router.push(
        `/dashboard/sites/${siteId}/collections/${collection.id}/items/${created.id}`,
      );
    } catch (e: unknown) {
      setCreateError(
        e instanceof Error ? e.message : `Unable to create ${collection.singularName}.`,
      );
      setIsCreating(false);
    }
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

  return (
    <div>
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
                    const slug =
                      e.currentTarget.form?.querySelector<HTMLInputElement>(
                        '[name="slug"]',
                      );
                    if (slug && !slug.dataset.edited) {
                      slug.value = slugify(e.currentTarget.value);
                    }
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
              <div>
                <Button type="submit" size="sm" disabled={isCreating}>
                  {isCreating ? "Creating…" : `Create ${collection.singularName}`}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 && !showCreate ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
          <FileText className="mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            No {collection.pluralName.toLowerCase()} yet
          </p>
          <Button size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New {collection.singularName}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/dashboard/sites/${siteId}/collections/${collection.id}/items/${item.id}`}
              className="group flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4 transition-colors hover:border-primary/40 hover:bg-accent/20"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-card-foreground">
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.slug}</p>
                </div>
              </div>
              <Badge
                variant={STATUS_VARIANT[item.status] ?? "secondary"}
                className="ml-4 shrink-0 text-[10px]"
              >
                {item.status}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

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
import { FileText, Layers, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { apiRequest } from "../lib/api";

interface ContentTypesListProps {
  siteId: string;
}

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  ACTIVE: "default",
  DRAFT: "secondary",
  ARCHIVED: "outline",
};

export function ContentTypesList({ siteId }: ContentTypesListProps) {
  const router = useRouter();
  const [contentTypes, setContentTypes] = useState<ContentTypeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();

  useEffect(() => {
    void apiRequest<ContentTypeSummary[]>(
      `/manage/sites/${siteId}/content-types`,
    )
      .then(setContentTypes)
      .finally(() => setLoading(false));
  }, [siteId]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setCreateError(undefined);
    const data = new FormData(event.currentTarget);

    try {
      const ct = await apiRequest<ContentTypeSummary>(
        `/manage/sites/${siteId}/content-types`,
        {
          method: "POST",
          body: JSON.stringify({
            name: data.get("name"),
            slug: data.get("slug"),
            description: data.get("description") || undefined,
          }),
        },
      );

      router.push(
        `/dashboard/sites/${siteId}/content-types/${ct.id}`,
      );
    } catch (e: unknown) {
      setCreateError(
        e instanceof Error ? e.message : "Unable to create content type.",
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
            Content Types
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define the structure of your site&apos;s content.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {showCreate ? "Cancel" : "New content type"}
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">New content type</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="ct-name">Name</Label>
                <Input
                  id="ct-name"
                  name="name"
                  placeholder="Article"
                  required
                  onChange={(e) => {
                    const slugInput = e.currentTarget.form?.querySelector<HTMLInputElement>(
                      '[name="slug"]',
                    );
                    if (slugInput && !slugInput.dataset.edited) {
                      slugInput.value = e.currentTarget.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, "");
                    }
                  }}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ct-slug">
                  Slug{" "}
                  <span className="font-normal text-muted-foreground">
                    (auto-derived, editable)
                  </span>
                </Label>
                <Input
                  id="ct-slug"
                  name="slug"
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  required
                  onInput={(e) => {
                    e.currentTarget.dataset.edited = "1";
                  }}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ct-desc">
                  Description{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input id="ct-desc" name="description" />
              </div>
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
              <div>
                <Button type="submit" size="sm" disabled={isCreating}>
                  {isCreating ? "Creating…" : "Create and edit"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : contentTypes.length === 0 && !showCreate ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <Layers className="mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            No content types yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Create your first content type to start modeling your content.
          </p>
          <Button size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New content type
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {contentTypes.map((ct) => (
            <Link
              key={ct.id}
              href={`/dashboard/sites/${siteId}/content-types/${ct.id}`}
              className="group flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4 transition-colors hover:border-primary/40 hover:bg-accent/20"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-card-foreground">
                    {ct.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ct.slug} · {ct.fieldCount} field
                    {ct.fieldCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <Badge
                variant={STATUS_VARIANT[ct.status] ?? "secondary"}
                className="shrink-0 ml-4 text-[10px]"
              >
                {ct.status}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

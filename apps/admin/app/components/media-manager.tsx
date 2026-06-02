"use client";

import type { MediaAssetSummary } from "@structo/contracts";
import { Button } from "@structo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@structo/ui/components/card";
import { Input } from "@structo/ui/components/input";
import { Label } from "@structo/ui/components/label";
import { Textarea } from "@structo/ui/components/textarea";
import { FileText, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { apiRequest } from "../lib/api";

export function MediaManager({ siteId }: { siteId: string }) {
  const [assets, setAssets] = useState<MediaAssetSummary[]>([]);
  const [selected, setSelected] = useState<MediaAssetSummary>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(
    () =>
      apiRequest<MediaAssetSummary[]>(`/manage/sites/${siteId}/media`).then(
        setAssets,
      ),
    [siteId],
  );

  useEffect(() => {
    void load().catch((e: unknown) =>
      setError(e instanceof Error ? e.message : "Unable to load media."),
    );
  }, [load]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const form = event.currentTarget;
      await apiRequest(`/manage/sites/${siteId}/media`, {
        method: "POST",
        body: new FormData(form),
      });
      form.reset();
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to upload media.");
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError(undefined);
    const data = new FormData(event.currentTarget);
    try {
      const updated = await apiRequest<MediaAssetSummary>(
        `/manage/sites/${siteId}/media/${selected.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            alt: String(data.get("alt")) || null,
            caption: String(data.get("caption")) || null,
          }),
        },
      );
      setSelected(updated);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to update media.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(asset: MediaAssetSummary) {
    if (!window.confirm(`Delete ${asset.filename}?`)) return;
    setBusy(true);
    setError(undefined);
    try {
      await apiRequest(`/manage/sites/${siteId}/media/${asset.id}`, {
        method: "DELETE",
      });
      if (selected?.id === asset.id) setSelected(undefined);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to delete media.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Content
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">Media</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload site-scoped images and documents for content fields.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Upload file</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={upload} className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="media-file">Image or PDF</Label>
              <Input
                id="media-file"
                name="file"
                type="file"
                required
                accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
              />
            </div>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-4 w-4" />
              )}
              Upload
            </Button>
            <p className="text-xs text-muted-foreground">
              JPEG, PNG, GIF, WebP or PDF. Maximum 10 MB.
            </p>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => setSelected(asset)}
              className={`group rounded-lg border p-2 text-left transition-colors ${
                selected?.id === asset.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <AssetPreview asset={asset} />
              <p className="mt-2 truncate text-xs font-medium">
                {asset.filename}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {formatBytes(asset.size)}
              </p>
            </button>
          ))}
          {assets.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-border py-14 text-center">
              <ImageIcon className="mx-auto mb-2 h-7 w-7 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No media yet</p>
            </div>
          )}
        </div>

        {selected && (
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="truncate text-sm">
                {selected.filename}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form key={selected.id} onSubmit={save} className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="media-alt">Alt text</Label>
                  <Input
                    id="media-alt"
                    name="alt"
                    maxLength={300}
                    defaultValue={selected.alt ?? ""}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="media-caption">Caption</Label>
                  <Textarea
                    id="media-caption"
                    name="caption"
                    maxLength={1000}
                    rows={4}
                    defaultValue={selected.caption ?? ""}
                  />
                </div>
                <Button type="submit" size="sm" disabled={busy}>
                  Save metadata
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => remove(selected)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete file
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function AssetPreview({ asset }: { asset: MediaAssetSummary }) {
  if (asset.mimeType.startsWith("image/")) {
    return (
      <Image
        src={asset.url}
        alt={asset.alt ?? ""}
        width={240}
        height={240}
        unoptimized
        className="aspect-square w-full rounded-md object-cover"
      />
    );
  }
  return (
    <div className="flex aspect-square items-center justify-center rounded-md bg-muted text-muted-foreground">
      <FileText className="h-8 w-8" />
    </div>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

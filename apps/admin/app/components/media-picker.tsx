"use client";

import type { MediaAssetSummary } from "@structo/contracts";
import { Button } from "@structo/ui/components/button";
import { FileText, ImageIcon, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { apiRequest } from "../lib/api";

interface MediaPickerProps {
  siteId: string;
  value: string | string[];
  multiple?: boolean;
  disabled?: boolean;
  onChange: (value: string | string[]) => void;
}

export function MediaPicker({
  siteId,
  value,
  multiple = false,
  disabled = false,
  onChange,
}: MediaPickerProps) {
  const [assets, setAssets] = useState<MediaAssetSummary[]>([]);
  const [open, setOpen] = useState(false);
  const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);

  useEffect(() => {
    void apiRequest<MediaAssetSummary[]>(`/manage/sites/${siteId}/media`)
      .then(setAssets)
      .catch(() => setAssets([]));
  }, [siteId]);

  function choose(assetId: string) {
    if (!multiple) {
      onChange(assetId);
      setOpen(false);
      return;
    }
    onChange(
      selected.has(assetId)
        ? [...selected].filter((id) => id !== assetId)
        : [...selected, assetId],
    );
  }

  function remove(assetId: string) {
    onChange(multiple ? [...selected].filter((id) => id !== assetId) : "");
  }

  return (
    <div className="grid gap-2">
      {selected.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {[...selected].map((id) => {
            const asset = assets.find((candidate) => candidate.id === id);
            return (
              <div
                key={id}
                className="flex items-center gap-2 rounded-md border border-border bg-muted/20 p-2"
              >
                <MediaPreview asset={asset} compact />
                <span className="max-w-40 truncate text-xs">
                  {asset?.filename ?? id}
                </span>
                {!disabled && (
                  <button
                    type="button"
                    title="Remove"
                    onClick={() => remove(id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
        {open ? "Close library" : multiple ? "Choose media" : "Choose file"}
      </Button>
      {open && (
        <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto rounded-md border border-border bg-muted/10 p-2 sm:grid-cols-3">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => choose(asset.id)}
              className={`rounded-md border p-2 text-left transition-colors ${
                selected.has(asset.id)
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <MediaPreview asset={asset} />
              <p className="mt-1 truncate text-[11px]">{asset.filename}</p>
            </button>
          ))}
          {assets.length === 0 && (
            <p className="col-span-full p-4 text-center text-xs text-muted-foreground">
              Upload files from the Media area first.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MediaPreview({
  asset,
  compact = false,
}: {
  asset?: MediaAssetSummary;
  compact?: boolean;
}) {
  const className = compact
    ? "h-8 w-8 rounded object-cover"
    : "aspect-square w-full rounded object-cover";
  if (asset?.mimeType.startsWith("image/")) {
    return (
      <Image
        src={asset.url}
        alt={asset.alt ?? ""}
        width={compact ? 32 : 180}
        height={compact ? 32 : 180}
        unoptimized
        className={className}
      />
    );
  }
  return (
    <div
      className={`${className} flex items-center justify-center bg-muted text-muted-foreground`}
    >
      <FileText className="h-5 w-5" />
    </div>
  );
}

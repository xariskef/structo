"use client";

import { Badge } from "@structo/ui/components/badge";
import { Button } from "@structo/ui/components/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@structo/ui/components/tabs";
import type { ContentTypeDetail, ContentTypeExport } from "@structo/contracts";
import { Download, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "../lib/api";
import { CollectionItems } from "./collection-items";
import { ContentTypeEditor } from "./content-type-editor";
import { TaxonomyManager } from "./taxonomy-manager";

interface CollectionViewProps {
  siteId: string;
  contentTypeId: string;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  DRAFT: "secondary",
  ARCHIVED: "outline",
};

export function CollectionView({ siteId, contentTypeId }: CollectionViewProps) {
  const [collection, setCollection] = useState<ContentTypeDetail | null>(null);
  const [error, setError] = useState<string>();
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    void apiRequest<ContentTypeDetail>(
      `/manage/sites/${siteId}/content-types/${contentTypeId}`,
    )
      .then((nextCollection) => {
        if (nextCollection.kind !== "COLLECTION") {
          setError("This content type is a page. Open it from Pages.");
          return;
        }
        setCollection(nextCollection);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Unable to load collection."),
      );
  }, [siteId, contentTypeId]);

  async function handleExport() {
    if (!collection) return;
    setIsExporting(true);
    try {
      const data = await apiRequest<ContentTypeExport>(
        `/manage/sites/${siteId}/content-types/${contentTypeId}/export`,
      );
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${collection.slug}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }
  if (error) {
    return (
      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (!collection) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="max-w-12xl">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-1.5">
          <Link
            href={`/dashboard/sites/${siteId}/collections`}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Collections
          </Link>
          <span className="text-[11px] text-muted-foreground">/</span>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {collection.pluralName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {collection.pluralName}
          </h1>
          <Badge
            variant={STATUS_VARIANT[collection.status] ?? "secondary"}
            className="text-[10px]"
          >
            {collection.status}
          </Badge>
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleExport()}
              disabled={isExporting}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {isExporting ? "Exporting…" : "Export"}
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{collection.slug}</p>
      </div>

      <Tabs defaultValue="content">
        <TabsList className="mb-6">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
        </TabsList>

        <TabsContent value="content">
          <CollectionItems siteId={siteId} collection={collection} />
        </TabsContent>

        <TabsContent value="structure">
          <ContentTypeEditor
            siteId={siteId}
            contentTypeId={contentTypeId}
            onContentTypeChange={setCollection}
          />
        </TabsContent>

        <TabsContent value="categories">
          <TaxonomyManager
            siteId={siteId}
            contentTypeId={contentTypeId}
            scope="CONTENT_TYPE"
            kind="CATEGORY"
          />
        </TabsContent>

        <TabsContent value="tags">
          <TaxonomyManager
            siteId={siteId}
            contentTypeId={contentTypeId}
            scope="CONTENT_TYPE"
            kind="TAG"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

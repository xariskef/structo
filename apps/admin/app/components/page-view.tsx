"use client";

import { Badge } from "@structo/ui/components/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@structo/ui/components/tabs";
import type { ContentTypeDetail, EntryDetail } from "@structo/contracts";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { apiRequest } from "../lib/api";
import { ContentTypeEditor } from "./content-type-editor";
import { EntryEditor } from "./entry-editor";

interface PageViewProps {
  siteId: string;
  contentTypeId: string;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  DRAFT: "secondary",
  ARCHIVED: "outline",
};

// Content tab for a single page: resolves (or creates) the one backing item
// once the page structure has been activated.
function PageContent({
  siteId,
  page,
}: {
  siteId: string;
  page: ContentTypeDetail;
}) {
  const [entryId, setEntryId] = useState<string | null>(page.singleEntryId);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string>();
  // Guards against React's double-invoked effect (dev strict mode) issuing two
  // concurrent get-or-create requests.
  const requestedRef = useRef(false);

  useEffect(() => {
    if (page.status !== "ACTIVE" || entryId || requestedRef.current) return;
    requestedRef.current = true;
    setResolving(true);
    void apiRequest<EntryDetail>(
      `/manage/sites/${siteId}/content-types/${page.id}/single`,
      { method: "POST" },
    )
      .then((entry) => setEntryId(entry.id))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Unable to open page content."),
      )
      .finally(() => setResolving(false));
  }, [siteId, page.id, page.status, entryId]);

  if (page.status === "ARCHIVED") {
    return (
      <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
        This page is archived. Its content is no longer editable.
      </div>
    );
  }

  if (page.status !== "ACTIVE") {
    return (
      <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
        Activate this page from the{" "}
        <span className="font-medium text-foreground">Structure</span> tab
        before editing its content.
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (resolving || !entryId) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Opening content…
      </div>
    );
  }

  return (
    <EntryEditor
      siteId={siteId}
      entryId={entryId}
      expectedContentTypeId={page.id}
      allowArchive={false}
    />
  );
}

export function PageView({ siteId, contentTypeId }: PageViewProps) {
  const [page, setPage] = useState<ContentTypeDetail | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void apiRequest<ContentTypeDetail>(
      `/manage/sites/${siteId}/content-types/${contentTypeId}`,
    )
      .then((nextPage) => {
        if (nextPage.kind !== "SINGLE") {
          setError("This content type is a collection. Open it from Collections.");
          return;
        }
        setPage(nextPage);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Unable to load page."),
      );
  }, [siteId, contentTypeId]);

  if (error) {
    return (
      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (!page) {
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
            href={`/dashboard/sites/${siteId}/pages`}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Pages
          </Link>
          <span className="text-[11px] text-muted-foreground">/</span>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {page.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{page.name}</h1>
          <Badge
            variant={STATUS_VARIANT[page.status] ?? "secondary"}
            className="text-[10px]"
          >
            {page.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">/{page.slug}</p>
      </div>

      <Tabs defaultValue="content">
        <TabsList className="mb-6">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="structure">Structure</TabsTrigger>
        </TabsList>

        <TabsContent value="content">
          <PageContent siteId={siteId} page={page} />
        </TabsContent>

        <TabsContent value="structure">
          <ContentTypeEditor
            siteId={siteId}
            contentTypeId={contentTypeId}
            onContentTypeChange={setPage}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

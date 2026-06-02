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
import type {
  ContentTypeSummary,
  ImportContentTypeResult,
} from "@structo/contracts";
import { FileText, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

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

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importPreview, setImportPreview] = useState<{
    name: string;
    slug: string;
    fieldCount: number;
    entryCount: number;
  } | null>(null);
  const [importParseError, setImportParseError] = useState<string>();
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] =
    useState<ImportContentTypeResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function parseImportJson(text: string) {
    setImportJson(text);
    setImportParseError(undefined);
    setImportPreview(null);
    if (!text.trim()) return;
    try {
      const parsed = JSON.parse(text) as unknown;
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        !("contentType" in parsed) ||
        typeof (parsed as Record<string, unknown>).contentType !== "object"
      ) {
        setImportParseError('JSON must have a "contentType" object.');
        return;
      }
      const ct = (parsed as Record<string, unknown>).contentType as Record<
        string,
        unknown
      >;
      const entries = (parsed as Record<string, unknown>).entries;
      setImportPreview({
        name: String(ct.name ?? ""),
        slug: String(ct.slug ?? ""),
        fieldCount: Array.isArray(ct.fields) ? ct.fields.length : 0,
        entryCount: Array.isArray(entries) ? entries.length : 0,
      });
    } catch {
      setImportParseError("Invalid JSON — check syntax and try again.");
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      parseImportJson(String(ev.target?.result ?? ""));
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!importJson.trim()) return;
    setIsImporting(true);
    setImportResult(null);
    try {
      const result = await apiRequest<ImportContentTypeResult>(
        `/manage/sites/${siteId}/content-types/import`,
        { method: "POST", body: importJson },
      );
      setImportResult(result);
      setPages((prev) => [
        ...prev,
        {
          id: result.contentType.id,
          siteId: result.contentType.siteId,
          kind: result.contentType.kind,
          name: result.contentType.name,
          singularName: result.contentType.singularName,
          pluralName: result.contentType.pluralName,
          slug: result.contentType.slug,
          status: result.contentType.status,
          fieldCount: result.contentType.fields.length,
          singleEntryId: result.contentType.singleEntryId,
          singleEntryStatus: null,
          itemCount: result.entriesCreated,
          createdAt: result.contentType.createdAt,
          updatedAt: result.contentType.updatedAt,
        },
      ]);
    } catch (e: unknown) {
      setImportParseError(
        e instanceof Error ? e.message : "Import failed. Check the JSON.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  function resetImport() {
    setShowImport(false);
    setImportJson("");
    setImportPreview(null);
    setImportParseError(undefined);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setShowImport((v) => !v);
              setShowCreate(false);
            }}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {showImport ? "Cancel" : "Import"}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setShowCreate((v) => !v);
              setShowImport(false);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {showCreate ? "Cancel" : "New page"}
          </Button>
        </div>
      </div>

      {/* Import form */}
      {showImport && (
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Import page</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {importResult ? (
              <div className="flex flex-col gap-3">
                <div className="rounded-md bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
                  <p className="font-medium">
                    ✓ "{importResult.contentType.name}" imported successfully
                  </p>
                  {importResult.entriesCreated > 0 && (
                    <p className="mt-0.5 text-xs">
                      Page content created
                      {importResult.entriesFailed > 0
                        ? ` (${importResult.entriesFailed} entries failed)`
                        : ""}
                    </p>
                  )}
                </div>
                {importResult.errors.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {importResult.errors.map((err, i) => (
                      <li key={i} className="text-xs text-destructive">
                        {`• ${err}`}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      router.push(
                        `/dashboard/sites/${siteId}/pages/${importResult.contentType.id}`,
                      )
                    }
                  >
                    Open page
                  </Button>
                  <Button variant="outline" size="sm" onClick={resetImport}>
                    Import another
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-1.5">
                  <Label>Upload JSON file</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1 file:text-sm file:font-medium hover:file:bg-accent"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="page-import-json">Or paste JSON</Label>
                  <textarea
                    id="page-import-json"
                    rows={8}
                    value={importJson}
                    onChange={(e) => parseImportJson(e.target.value)}
                    placeholder='{"version":"1","contentType":{"kind":"SINGLE",...},"entries":[...]}'
                    className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                {importParseError && (
                  <p className="text-sm text-destructive">{importParseError}</p>
                )}
                {importPreview && !importParseError && (
                  <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
                    <p className="font-medium">{importPreview.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {importPreview.slug} · {importPreview.fieldCount} field
                      {importPreview.fieldCount !== 1 ? "s" : ""}
                      {importPreview.entryCount > 0
                        ? ` · with content`
                        : " · no content"}
                    </p>
                  </div>
                )}
                <div>
                  <Button
                    size="sm"
                    onClick={() => void handleImport()}
                    disabled={
                      isImporting || !importPreview || !!importParseError
                    }
                  >
                    {isImporting ? "Importing…" : "Import page"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

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

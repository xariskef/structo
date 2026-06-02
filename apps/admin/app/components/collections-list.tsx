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
import { Layers, Plus, Upload } from "lucide-react";
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
            preset: data.get("preset"),
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
      setCollections((prev) => [
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
            Collections
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reusable content types that hold many items — articles, products,
            services, and more.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetImport();
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
            {showCreate ? "Cancel" : "New collection"}
          </Button>
        </div>
      </div>

      {/* Import form */}
      {showImport && (
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Import collection</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {importResult ? (
              <div className="flex flex-col gap-3">
                <div className="rounded-md bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
                  <p className="font-medium">
                    ✓ "{importResult.contentType.pluralName}" imported
                    successfully
                  </p>
                  <p className="mt-0.5 text-xs">
                    {importResult.entriesCreated} entr
                    {importResult.entriesCreated !== 1 ? "ies" : "y"} created
                    {importResult.entriesFailed > 0
                      ? `, ${importResult.entriesFailed} failed`
                      : ""}
                  </p>
                </div>
                {importResult.errors.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {importResult.errors.map((err, i) => (
                      <li
                        key={i}
                        className="text-xs text-destructive"
                      >{`• ${err}`}</li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      router.push(
                        `/dashboard/sites/${siteId}/collections/${importResult.contentType.id}`,
                      )
                    }
                  >
                    Open collection
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
                  <Label htmlFor="import-json">Or paste JSON</Label>
                  <textarea
                    id="import-json"
                    rows={8}
                    value={importJson}
                    onChange={(e) => parseImportJson(e.target.value)}
                    placeholder='{"version":"1","contentType":{...},"entries":[...]}'
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
                      {importPreview.fieldCount !== 1 ? "s" : ""} ·{" "}
                      {importPreview.entryCount} entr
                      {importPreview.entryCount !== 1 ? "ies" : "y"}
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
                    {isImporting ? "Importing…" : "Import collection"}
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
            <CardTitle className="text-base">New collection</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="col-preset">Starting point</Label>
                <select
                  id="col-preset"
                  name="preset"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue="blank"
                >
                  <option value="blank">Blank collection</option>
                  <option value="article">
                    Articles with categories and tags
                  </option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Presets only set the initial structure. You can change every
                  field and taxonomy later.
                </p>
              </div>
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

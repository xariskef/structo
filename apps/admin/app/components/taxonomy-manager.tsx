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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@structo/ui/components/tabs";
import { Textarea } from "@structo/ui/components/textarea";
import type {
  TaxonomyDefinitionDetail,
  TaxonomyKind,
  TaxonomyScope,
  TaxonomyTermSummary,
} from "@structo/contracts";
import type { FieldDefinition } from "@structo/field-kit";
import { CheckCircle2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { apiRequest } from "../lib/api";
import { FieldsBuilder } from "./content-type-editor";
import { FieldRenderer } from "./entry-field-renderer";

interface TaxonomyManagerProps {
  siteId: string;
  kind: TaxonomyKind;
  scope: TaxonomyScope;
  contentTypeId?: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function TaxonomyManager({
  siteId,
  kind,
  scope,
  contentTypeId,
}: TaxonomyManagerProps) {
  const [definition, setDefinition] = useState<TaxonomyDefinitionDetail>();
  const [terms, setTerms] = useState<TaxonomyTermSummary[]>([]);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [editing, setEditing] = useState<TaxonomyTermSummary>();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [data, setData] = useState<Record<string, unknown>>({});
  const [parentId, setParentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();
  const plural = kind === "CATEGORY" ? "Categories" : "Tags";
  const singular = kind === "CATEGORY" ? "category" : "tag";

  const definitionQuery = new URLSearchParams({
    scope,
    ...(contentTypeId ? { contentTypeId } : {}),
  }).toString();

  const loadTerms = useCallback(
    (definitionId: string) =>
      apiRequest<TaxonomyTermSummary[]>(
        `/manage/sites/${siteId}/taxonomy-definitions/${definitionId}/terms`,
      ).then(setTerms),
    [siteId],
  );

  const load = useCallback(async () => {
    const definitions = await apiRequest<TaxonomyDefinitionDetail[]>(
      `/manage/sites/${siteId}/taxonomy-definitions?${definitionQuery}`,
    );
    const next = definitions.find((candidate) => candidate.kind === kind);
    if (!next) throw new Error(`${plural} schema is not available.`);
    setDefinition(next);
    setFields(next.fields);
    await loadTerms(next.id);
  }, [definitionQuery, kind, loadTerms, plural, siteId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- remote loading updates state after its promises resolve.
    void load()
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : `Unable to load ${plural}.`),
      )
      .finally(() => setLoading(false));
  }, [load, plural]);

  function resetForm() {
    setEditing(undefined);
    setName("");
    setSlug("");
    setSlugEdited(false);
    setDescription("");
    setSeoTitle("");
    setSeoDescription("");
    setData({});
    setParentId("");
  }

  function edit(term: TaxonomyTermSummary) {
    setEditing(term);
    setName(term.name);
    setSlug(term.slug);
    setSlugEdited(true);
    setDescription(term.description ?? "");
    setSeoTitle(term.seoTitle ?? "");
    setSeoDescription(term.seoDescription ?? "");
    setData(term.data);
    setParentId(term.parentId ?? "");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!definition) return;
    setBusy(true);
    setError(undefined);
    try {
      const body = JSON.stringify({
        name,
        slug,
        description: editing ? description || null : description || undefined,
        seoTitle: editing ? seoTitle || null : seoTitle || undefined,
        seoDescription: editing
          ? seoDescription || null
          : seoDescription || undefined,
        data,
        ...(kind === "CATEGORY"
          ? { parentId: editing ? parentId || null : parentId || undefined }
          : {}),
      });
      await apiRequest(
        editing
          ? `/manage/sites/${siteId}/taxonomy-terms/${editing.id}`
          : `/manage/sites/${siteId}/taxonomy-definitions/${definition.id}/terms`,
        { method: editing ? "PATCH" : "POST", body },
      );
      resetForm();
      await loadTerms(definition.id);
      showSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : `Unable to save ${singular}.`);
    } finally {
      setBusy(false);
    }
  }

  async function saveFields() {
    if (!definition) return;
    setBusy(true);
    setError(undefined);
    try {
      const updated = await apiRequest<TaxonomyDefinitionDetail>(
        `/manage/sites/${siteId}/taxonomy-definitions/${definition.id}`,
        { method: "PATCH", body: JSON.stringify({ fields }) },
      );
      setDefinition(updated);
      setFields(updated.fields);
      showSaved();
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : `Unable to save ${plural} fields.`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(term: TaxonomyTermSummary) {
    if (!window.confirm(`Delete ${term.name}?`)) return;
    setBusy(true);
    setError(undefined);
    try {
      await apiRequest(`/manage/sites/${siteId}/taxonomy-terms/${term.id}`, {
        method: "DELETE",
      });
      if (definition) await loadTerms(definition.id);
      if (editing?.id === term.id) resetForm();
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : `Unable to delete ${singular}.`,
      );
    } finally {
      setBusy(false);
    }
  }

  function showSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading {plural.toLowerCase()}…
      </div>
    );
  }

  return (
    <Tabs defaultValue="terms">
      <TabsList className="mb-6">
        <TabsTrigger value="terms">Terms</TabsTrigger>
        <TabsTrigger value="fields">Fields</TabsTrigger>
      </TabsList>

      {error && (
        <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p className="mb-4 flex items-center gap-1.5 text-sm text-primary">
          <CheckCircle2 className="h-4 w-4" />
          Saved
        </p>
      )}

      <TabsContent value="terms">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <TermsTable
            terms={terms}
            kind={kind}
            busy={busy}
            onEdit={edit}
            onRemove={remove}
          />

          <Card className="h-fit">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">
                {editing ? `Edit ${singular}` : `New ${singular}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="flex flex-col gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="taxonomy-name">Name</Label>
                  <Input
                    id="taxonomy-name"
                    value={name}
                    required
                    onChange={(event) => {
                      const next = event.currentTarget.value;
                      setName(next);
                      if (!slugEdited) setSlug(slugify(next));
                    }}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="taxonomy-slug">Slug</Label>
                  <Input
                    id="taxonomy-slug"
                    value={slug}
                    required
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    onChange={(event) => {
                      setSlug(event.currentTarget.value);
                      setSlugEdited(true);
                    }}
                  />
                </div>
                {kind === "CATEGORY" && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="taxonomy-parent">Parent category</Label>
                    <select
                      id="taxonomy-parent"
                      value={parentId}
                      onChange={(event) =>
                        setParentId(event.currentTarget.value)
                      }
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">None</option>
                      {terms
                        .filter((term) => term.id !== editing?.id)
                        .map((term) => (
                          <option key={term.id} value={term.id}>
                            {term.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
                <div className="grid gap-1.5">
                  <Label htmlFor="taxonomy-description">Description</Label>
                  <Textarea
                    id="taxonomy-description"
                    value={description}
                    rows={3}
                    onChange={(event) =>
                      setDescription(event.currentTarget.value)
                    }
                  />
                </div>

                <div className="rounded-md border border-border p-3">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    SEO
                  </p>
                  <div className="grid gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="taxonomy-seo-title">Meta title</Label>
                      <Input
                        id="taxonomy-seo-title"
                        value={seoTitle}
                        onChange={(event) =>
                          setSeoTitle(event.currentTarget.value)
                        }
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="taxonomy-seo-description">
                        Meta description
                      </Label>
                      <Textarea
                        id="taxonomy-seo-description"
                        value={seoDescription}
                        rows={3}
                        onChange={(event) =>
                          setSeoDescription(event.currentTarget.value)
                        }
                      />
                    </div>
                  </div>
                </div>

                {fields.length > 0 && (
                  <div className="grid gap-3 border-t border-border pt-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Custom fields
                    </p>
                    {fields.map((field) => (
                      <FieldRenderer
                        key={field.id}
                        field={field}
                        value={data[field.key]}
                        onChange={(value) =>
                          setData((previous) => ({
                            ...previous,
                            [field.key]: value,
                          }))
                        }
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Button type="submit" size="sm" disabled={busy}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    {busy
                      ? "Saving…"
                      : editing
                        ? "Save changes"
                        : `Add ${singular}`}
                  </Button>
                  {editing && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={resetForm}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="fields">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">{plural} custom fields</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Name, slug, description and SEO are built in. Add only the extra
              structured fields this taxonomy needs.
            </p>
          </div>
          <Button type="button" size="sm" onClick={saveFields} disabled={busy}>
            {busy ? "Saving…" : "Save fields"}
          </Button>
        </div>
        <FieldsBuilder fields={fields} onChange={setFields} />
      </TabsContent>
    </Tabs>
  );
}

function TermsTable({
  terms,
  kind,
  busy,
  onEdit,
  onRemove,
}: {
  terms: TaxonomyTermSummary[];
  kind: TaxonomyKind;
  busy: boolean;
  onEdit: (term: TaxonomyTermSummary) => void;
  onRemove: (term: TaxonomyTermSummary) => void;
}) {
  const plural = kind === "CATEGORY" ? "categories" : "tags";
  if (terms.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-12 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          No {plural} yet
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left">
          <tr>
            <th className="px-3 py-2.5 font-semibold">Name</th>
            <th className="px-3 py-2.5 font-semibold">Slug</th>
            <th className="px-3 py-2.5 font-semibold">Items</th>
            <th className="w-px px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {terms.map((term) => {
            const parent = terms.find(
              (candidate) => candidate.id === term.parentId,
            );
            return (
              <tr key={term.id} className="border-t border-border">
                <td className="px-3 py-2.5">
                  <p className="font-medium">{term.name}</p>
                  {parent && (
                    <p className="text-xs text-muted-foreground">
                      Parent: {parent.name}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                  {term.slug}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {term.itemCount}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      title="Edit"
                      disabled={busy}
                      onClick={() => onEdit(term)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      disabled={busy}
                      onClick={() => onRemove(term)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
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
  );
}

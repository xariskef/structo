"use client";

import { Button } from "@structo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@structo/ui/components/card";
import type {
  ContentTypeDetail,
  TaxonomyKind,
  TaxonomyTermSummary,
} from "@structo/contracts";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { apiRequest } from "../lib/api";

interface EntryTaxonomiesProps {
  siteId: string;
  entryId: string;
  contentTypeId: string;
  disabled?: boolean;
}

export function EntryTaxonomies({
  siteId,
  entryId,
  contentTypeId,
  disabled = false,
}: EntryTaxonomiesProps) {
  const [enabled, setEnabled] = useState<TaxonomyKind[]>([]);
  const [terms, setTerms] = useState<TaxonomyTermSummary[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void Promise.all([
      apiRequest<ContentTypeDetail>(
        `/manage/sites/${siteId}/content-types/${contentTypeId}`,
      ),
      apiRequest<TaxonomyTermSummary[]>(
        `/manage/sites/${siteId}/entries/${entryId}/available-taxonomy-terms`,
      ),
      apiRequest<TaxonomyTermSummary[]>(
        `/manage/sites/${siteId}/entries/${entryId}/taxonomy-terms`,
      ),
    ])
      .then(([contentType, allTerms, assigned]) => {
        setEnabled(contentType.taxonomies);
        setTerms(allTerms);
        setSelected(new Set(assigned.map((term) => term.id)));
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Unable to load taxonomies."),
      )
      .finally(() => setLoading(false));
  }, [siteId, entryId, contentTypeId]);

  function toggle(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(undefined);
    try {
      const assigned = await apiRequest<TaxonomyTermSummary[]>(
        `/manage/sites/${siteId}/entries/${entryId}/taxonomy-terms`,
        { method: "PUT", body: JSON.stringify({ termIds: [...selected] }) },
      );
      setSelected(new Set(assigned.map((term) => term.id)));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to save taxonomies.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading taxonomies…
        </CardContent>
      </Card>
    );
  }
  if (enabled.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Taxonomies</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {enabled.map((kind) => (
          <div key={kind} className="grid gap-2">
            <p className="text-xs font-semibold">
              {kind === "CATEGORY" ? "Categories" : "Tags"}
            </p>
            {terms.filter((term) => term.kind === kind).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No terms available.
              </p>
            ) : (
              terms
                .filter((term) => term.kind === kind)
                .map((term) => (
                  <label
                    key={term.id}
                    className="flex items-center gap-2 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(term.id)}
                      disabled={disabled}
                      onChange={() => toggle(term.id)}
                      className="h-3.5 w-3.5"
                    />
                    {term.name}
                  </label>
                ))
            )}
          </div>
        ))}
        {error && <p className="text-xs text-destructive">{error}</p>}
        {!disabled && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save taxonomies"}
          </Button>
        )}
        {saved && (
          <p className="flex items-center gap-1 text-xs text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Saved
          </p>
        )}
      </CardContent>
    </Card>
  );
}

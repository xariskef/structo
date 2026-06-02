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
import type { ContentTypeDetail, TaxonomyKind } from "@structo/contracts";
import {
  FIELD_TYPE_GROUPS,
  FIELD_TYPE_META,
  FIELD_TYPES,
  createField,
  isNestedField,
  labelToKey,
} from "@structo/field-kit";
import type { FieldDefinition, FieldType } from "@structo/field-kit";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Loader2,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { apiRequest } from "../lib/api";

interface ContentTypeEditorProps {
  siteId: string;
  contentTypeId: string;
  // Notified whenever the content type is saved or activated so a parent tab
  // header can reflect the new status/version.
  onContentTypeChange?: (contentType: ContentTypeDetail) => void;
}

// ── Field type picker ────────────────────────────────────────────────────

function FieldTypePicker({
  onSelect,
  onCancel,
}: {
  onSelect: (type: FieldType) => void;
  onCancel: () => void;
}) {
  return (
    <Card className="mb-4" role="region" aria-label="Choose field type">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Choose field type</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {FIELD_TYPE_GROUPS.map((group) => {
          const types = FIELD_TYPES.filter(
            (t) => FIELD_TYPE_META[t].group === group,
          );
          return (
            <div key={group}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {group}
              </p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {types.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => onSelect(type)}
                    className="flex flex-col items-start rounded-md border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/50 hover:bg-accent/30"
                  >
                    <span className="text-sm font-medium">
                      {FIELD_TYPE_META[type].label}
                    </span>
                    <span className="mt-0.5 text-[11px] text-muted-foreground leading-tight">
                      {FIELD_TYPE_META[type].description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="w-fit"
        >
          Cancel
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Single field row ─────────────────────────────────────────────────────

function FieldRow({
  field,
  index,
  total,
  onUpdate,
  onDelete,
  onMove,
  depth = 1,
}: {
  field: FieldDefinition;
  index: number;
  total: number;
  onUpdate: (updated: FieldDefinition) => void;
  onDelete: () => void;
  onMove: (direction: "up" | "down") => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const keyRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-md border border-border bg-card">
      {/* Row header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/30" />

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left min-w-0"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate text-sm font-medium">{field.label}</span>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            {field.key}
          </span>
          <Badge variant="outline" className="shrink-0 text-[10px] py-0">
            {FIELD_TYPE_META[field.type]?.label ?? field.type}
          </Badge>
          {field.required && (
            <span className="shrink-0 text-[10px] font-semibold text-destructive">
              required
            </span>
          )}
        </button>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove("up")}
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove("down")}
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded config */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`label-${field.id}`} className="text-xs">
                Label
              </Label>
              <Input
                id={`label-${field.id}`}
                value={field.label}
                onChange={(e) => {
                  const newLabel = e.currentTarget.value;
                  const currentKey = field.key;
                  const expectedKey = labelToKey(field.label);
                  const autoKey =
                    currentKey === expectedKey || currentKey === ""
                      ? labelToKey(newLabel)
                      : currentKey;
                  if (keyRef.current && currentKey === expectedKey) {
                    keyRef.current.value = autoKey;
                  }
                  onUpdate({ ...field, label: newLabel, key: autoKey });
                }}
                className="h-8 text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`key-${field.id}`} className="text-xs">
                Key
              </Label>
              <Input
                id={`key-${field.id}`}
                ref={keyRef}
                value={field.key}
                onChange={(e) =>
                  onUpdate({ ...field, key: e.currentTarget.value })
                }
                pattern="[a-z][a-zA-Z0-9]*"
                className="h-8 font-mono text-sm"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`desc-${field.id}`} className="text-xs">
              Description{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id={`desc-${field.id}`}
              value={field.description ?? ""}
              onChange={(e) =>
                onUpdate({
                  ...field,
                  description: e.currentTarget.value || undefined,
                })
              }
              className="h-8 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`req-${field.id}`}
              checked={field.required}
              onChange={(e) =>
                onUpdate({ ...field, required: e.currentTarget.checked })
              }
              className="h-4 w-4 rounded border-border"
            />
            <Label
              htmlFor={`req-${field.id}`}
              className="text-xs cursor-pointer"
            >
              Required
            </Label>
          </div>

          {/* Select / MultiSelect options */}
          {(field.type === "select" || field.type === "multiSelect") && (
            <SelectOptionsEditor field={field} onUpdate={onUpdate} />
          )}

          {/* Nested fields for group / repeater */}
          {isNestedField(field.type) && (
            <NestedFieldsEditor
              field={field}
              onUpdate={onUpdate}
              depth={depth}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Select options editor ────────────────────────────────────────────────

function SelectOptionsEditor({
  field,
  onUpdate,
}: {
  field: FieldDefinition;
  onUpdate: (f: FieldDefinition) => void;
}) {
  const config = (field.config ?? {}) as {
    options?: Array<{ label: string; value: string }>;
  };
  const options = config.options ?? [];

  function setOptions(next: Array<{ label: string; value: string }>) {
    onUpdate({ ...field, config: { ...config, options: next } });
  }

  return (
    <div className="grid gap-2">
      <Label className="text-xs">Options</Label>
      {options.map((opt, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={opt.label}
            placeholder="Label"
            onChange={(e) => {
              const next = [...options];
              next[i] = { ...opt, label: e.currentTarget.value };
              setOptions(next);
            }}
            className="h-7 text-xs"
          />
          <Input
            value={opt.value}
            placeholder="value"
            onChange={(e) => {
              const next = [...options];
              next[i] = { ...opt, value: e.currentTarget.value };
              setOptions(next);
            }}
            className="h-7 font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => setOptions(options.filter((_, j) => j !== i))}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit h-7 text-xs"
        onClick={() => setOptions([...options, { label: "", value: "" }])}
      >
        <Plus className="mr-1 h-3 w-3" />
        Add option
      </Button>
    </div>
  );
}

// ── Nested fields editor (group / repeater) ──────────────────────────────

function NestedFieldsEditor({
  field,
  onUpdate,
  depth,
}: {
  field: FieldDefinition;
  onUpdate: (f: FieldDefinition) => void;
  depth: number;
}) {
  const config = (field.config ?? {}) as { fields?: FieldDefinition[] };
  const nested = config.fields ?? [];
  const [showPicker, setShowPicker] = useState(false);

  function setNested(next: FieldDefinition[]) {
    onUpdate({ ...field, config: { ...config, fields: next } });
  }

  function moveNested(index: number, direction: "up" | "down") {
    const next = [...nested];
    const swap = direction === "up" ? index - 1 : index + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap]!, next[index]!];
    setNested(next);
  }

  return (
    <div className="grid gap-2">
      <Label className="text-xs">Nested fields</Label>
      {nested.map((nf, i) => (
        <FieldRow
          key={nf.id}
          field={nf}
          index={i}
          total={nested.length}
          depth={depth + 1}
          onUpdate={(updated) =>
            setNested(
              nested.map((candidate, index) =>
                index === i ? updated : candidate,
              ),
            )
          }
          onDelete={() => setNested(nested.filter((_, index) => index !== i))}
          onMove={(direction) => moveNested(i, direction)}
        />
      ))}

      {depth >= 5 ? (
        <p className="text-xs text-muted-foreground">
          Maximum nesting depth reached.
        </p>
      ) : showPicker ? (
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            Add nested field
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {FIELD_TYPES.filter(
              (type) => depth < 4 || !isNestedField(type),
            ).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  const label = FIELD_TYPE_META[type].label;
                  const key = labelToKey(label);
                  setNested([...nested, createField(type, label, key)]);
                  setShowPicker(false);
                }}
                className="rounded border border-border bg-card px-2 py-1.5 text-left text-xs hover:border-primary/50 hover:bg-accent/30"
              >
                {FIELD_TYPE_META[type].label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 h-7 text-xs"
            onClick={() => setShowPicker(false)}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit h-7 text-xs"
          onClick={() => setShowPicker(true)}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add nested field
        </Button>
      )}
    </div>
  );
}

export function FieldsBuilder({
  fields,
  onChange,
  readOnly = false,
}: {
  fields: FieldDefinition[];
  onChange: (fields: FieldDefinition[]) => void;
  readOnly?: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);

  function addField(type: FieldType) {
    const label = FIELD_TYPE_META[type].label;
    onChange([...fields, createField(type, label, labelToKey(label))]);
    setShowPicker(false);
  }

  function updateField(index: number, updated: FieldDefinition) {
    onChange(
      fields.map((field, current) => (current === index ? updated : field)),
    );
  }

  function deleteField(index: number) {
    onChange(fields.filter((_, current) => current !== index));
  }

  function moveField(index: number, direction: "up" | "down") {
    const next = [...fields];
    const swap = direction === "up" ? index - 1 : index + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap]!, next[index]!];
    onChange(next);
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">
          Fields{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({fields.length})
          </span>
        </h2>
        {!readOnly && !showPicker && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowPicker(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add field
          </Button>
        )}
      </div>

      {showPicker && (
        <FieldTypePicker
          onSelect={addField}
          onCancel={() => setShowPicker(false)}
        />
      )}

      {fields.length === 0 && !showPicker ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">No fields yet</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Add a field when this schema needs extra structured data.
          </p>
          {!readOnly && (
            <Button
              type="button"
              size="sm"
              className="mt-3"
              onClick={() => setShowPicker(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add field
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {fields.map((field, index) =>
            readOnly ? (
              <div
                key={field.id}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2.5"
              >
                <span className="truncate text-sm font-medium">
                  {field.label}
                </span>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {field.key}
                </span>
                <Badge variant="outline" className="shrink-0 py-0 text-[10px]">
                  {FIELD_TYPE_META[field.type]?.label ?? field.type}
                </Badge>
              </div>
            ) : (
              <FieldRow
                key={field.id}
                field={field}
                index={index}
                total={fields.length}
                onUpdate={(updated) => updateField(index, updated)}
                onDelete={() => deleteField(index)}
                onMove={(direction) => moveField(index, direction)}
              />
            ),
          )}
        </div>
      )}
    </>
  );
}

// ── Main editor ──────────────────────────────────────────────────────────

export function ContentTypeEditor({
  siteId,
  contentTypeId,
  onContentTypeChange,
}: ContentTypeEditorProps) {
  const [ct, setCt] = useState<ContentTypeDetail | null>(null);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [taxonomies, setTaxonomies] = useState<TaxonomyKind[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void apiRequest<ContentTypeDetail>(
      `/manage/sites/${siteId}/content-types/${contentTypeId}`,
    )
      .then((data) => {
        setCt(data);
        setFields(data.fields);
        setTaxonomies(data.taxonomies);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Unable to load structure.");
      });
  }, [siteId, contentTypeId]);

  async function saveFields(): Promise<boolean> {
    setIsSaving(true);
    setError(undefined);
    try {
      const updated = await apiRequest<ContentTypeDetail>(
        `/manage/sites/${siteId}/content-types/${contentTypeId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ fields, taxonomies }),
        },
      );
      setCt(updated);
      setFields(updated.fields);
      setTaxonomies(updated.taxonomies);
      onContentTypeChange?.(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to save.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function activate() {
    setIsActivating(true);
    setError(undefined);
    try {
      if (!(await saveFields())) return;
      const updated = await apiRequest<ContentTypeDetail>(
        `/manage/sites/${siteId}/content-types/${contentTypeId}/activate`,
        { method: "POST" },
      );
      setCt(updated);
      onContentTypeChange?.(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to activate.");
    } finally {
      setIsActivating(false);
    }
  }

  async function archiveContentType() {
    setIsArchiving(true);
    setError(undefined);
    try {
      const updated = await apiRequest<ContentTypeDetail>(
        `/manage/sites/${siteId}/content-types/${contentTypeId}/archive`,
        { method: "POST" },
      );
      setCt(updated);
      onContentTypeChange?.(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to archive.");
    } finally {
      setIsArchiving(false);
    }
  }

  function toggleTaxonomy(taxonomy: TaxonomyKind) {
    setTaxonomies((previous) =>
      previous.includes(taxonomy)
        ? previous.filter((candidate) => candidate !== taxonomy)
        : [...previous, taxonomy],
    );
  }

  if (!ct) {
    if (error) {
      return <p className="text-sm text-destructive">{error}</p>;
    }

    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="max-w-12xl">
      {/* Action bar */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {ct.latestVersion !== null
            ? `Published structure: v${ct.latestVersion}`
            : "Draft — not yet activated"}
        </p>

        <div className="flex shrink-0 items-center gap-2">
          {ct.status !== "ARCHIVED" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={saveFields}
                disabled={isSaving}
              >
                {isSaving && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Save structure
              </Button>
              {ct.status !== "ACTIVE" || fields.length > 0 ? (
                <Button
                  size="sm"
                  onClick={activate}
                  disabled={isActivating || fields.length === 0}
                >
                  <Zap className="mr-1.5 h-3.5 w-3.5" />
                  {isActivating ? "Activating…" : "Activate"}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={archiveContentType}
                disabled={isArchiving}
              >
                <Archive className="mr-1.5 h-3.5 w-3.5" />
                {isArchiving ? "Archiving..." : "Archive"}
              </Button>
            </>
          )}
        </div>
      </div>

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

      {/* Description */}
      {ct.description && (
        <p className="mb-6 text-sm text-muted-foreground">{ct.description}</p>
      )}

      {ct.status === "ARCHIVED" && (
        <p className="mb-4 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          This content type is archived. Its structure is read-only.
        </p>
      )}

      <div className="mb-6 rounded-lg border border-border bg-card p-4">
        <h2 className="text-base font-semibold">Taxonomies</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Enable the editorial terms editors can assign to this content type.
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          {(["CATEGORY", "TAG"] as const).map((taxonomy) => (
            <label key={taxonomy} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={taxonomies.includes(taxonomy)}
                disabled={ct.status === "ARCHIVED"}
                onChange={() => toggleTaxonomy(taxonomy)}
                className="h-4 w-4"
              />
              {taxonomy === "CATEGORY" ? "Categories" : "Tags"}
            </label>
          ))}
        </div>
      </div>

      <FieldsBuilder
        fields={fields}
        onChange={setFields}
        readOnly={ct.status === "ARCHIVED"}
      />
    </div>
  );
}

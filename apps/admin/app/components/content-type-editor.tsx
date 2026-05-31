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
import type { ContentTypeDetail } from "@structo/contracts";
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
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { apiRequest } from "../lib/api";

interface ContentTypeEditorProps {
  siteId: string;
  contentTypeId: string;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  DRAFT: "secondary",
  ARCHIVED: "outline",
};

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
}: {
  field: FieldDefinition;
  index: number;
  total: number;
  onUpdate: (updated: FieldDefinition) => void;
  onDelete: () => void;
  onMove: (direction: "up" | "down") => void;
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
            <NestedFieldsEditor field={field} onUpdate={onUpdate} />
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
}: {
  field: FieldDefinition;
  onUpdate: (f: FieldDefinition) => void;
}) {
  const config = (field.config ?? {}) as { fields?: FieldDefinition[] };
  const nested = config.fields ?? [];
  const [showPicker, setShowPicker] = useState(false);

  function setNested(next: FieldDefinition[]) {
    onUpdate({ ...field, config: { ...config, fields: next } });
  }

  return (
    <div className="grid gap-2">
      <Label className="text-xs">Nested fields</Label>
      {nested.map((nf, i) => (
        <div
          key={nf.id}
          className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm"
        >
          <span className="flex-1 truncate font-medium">{nf.label}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {nf.key}
          </span>
          <button
            type="button"
            onClick={() => setNested(nested.filter((_, j) => j !== i))}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {showPicker ? (
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            Add nested field
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {FIELD_TYPES.filter((t) => !isNestedField(t)).map((type) => (
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

// ── Main editor ──────────────────────────────────────────────────────────

export function ContentTypeEditor({
  siteId,
  contentTypeId,
}: ContentTypeEditorProps) {
  const [ct, setCt] = useState<ContentTypeDetail | null>(null);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string>();
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    void apiRequest<ContentTypeDetail>(
      `/manage/sites/${siteId}/content-types/${contentTypeId}`,
    ).then((data) => {
      setCt(data);
      setFields(data.fields);
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
          body: JSON.stringify({ fields }),
        },
      );
      setCt(updated);
      setFields(updated.fields);
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to activate.");
    } finally {
      setIsActivating(false);
    }
  }

  function addField(type: FieldType) {
    const label = FIELD_TYPE_META[type].label;
    const key = labelToKey(label);
    setFields((prev) => [...prev, createField(type, label, key)]);
    setShowPicker(false);
  }

  function updateField(index: number, updated: FieldDefinition) {
    setFields((prev) => prev.map((f, i) => (i === index ? updated : f)));
  }

  function deleteField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  function moveField(index: number, direction: "up" | "down") {
    setFields((prev) => {
      const next = [...prev];
      const swap = direction === "up" ? index - 1 : index + 1;
      if (swap < 0 || swap >= next.length) return prev;
      [next[index], next[swap]] = [next[swap]!, next[index]!];
      return next;
    });
  }

  if (!ct) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/dashboard/sites/${siteId}/content-types`}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Content Types
            </Link>
            <span className="text-[11px] text-muted-foreground">/</span>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {ct.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{ct.name}</h1>
            <Badge
              variant={STATUS_VARIANT[ct.status] ?? "secondary"}
              className="text-[10px]"
            >
              {ct.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {ct.slug}
            {ct.latestVersion !== null ? ` · v${ct.latestVersion}` : ""}
          </p>
        </div>

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
                Save
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

      {/* Fields section */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">
          Fields{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({fields.length})
          </span>
        </h2>
        {ct.status !== "ARCHIVED" && !showPicker && (
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

      {/* Field type picker */}
      {showPicker && (
        <FieldTypePicker
          onSelect={addField}
          onCancel={() => setShowPicker(false)}
        />
      )}

      {/* Field list */}
      {fields.length === 0 && !showPicker ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">No fields yet</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Add your first field to define this content type.
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-3"
            onClick={() => setShowPicker(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add field
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {fields.map((field, i) => (
            <FieldRow
              key={field.id}
              field={field}
              index={i}
              total={fields.length}
              onUpdate={(updated) => updateField(i, updated)}
              onDelete={() => deleteField(i)}
              onMove={(dir) => moveField(i, dir)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

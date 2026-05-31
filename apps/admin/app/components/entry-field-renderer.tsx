"use client";

import { Input } from "@structo/ui/components/input";
import { Label } from "@structo/ui/components/label";
import { Textarea } from "@structo/ui/components/textarea";
import { Button } from "@structo/ui/components/button";
import type { FieldDefinition } from "@structo/field-kit";
import { isNestedField } from "@structo/field-kit";
import { Plus, Trash2 } from "lucide-react";

interface FieldRendererProps {
  field: FieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

export function FieldRenderer({
  field,
  value,
  onChange,
  disabled = false,
}: FieldRendererProps) {
  const str = typeof value === "string" ? value : "";
  const num = typeof value === "number" ? value : "";
  const bool = typeof value === "boolean" ? value : false;

  const inputClass =
    "w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60";

  switch (field.type) {
    case "text":
    case "url":
    case "email":
      return (
        <FieldWrap field={field}>
          <Input
            type={
              field.type === "url"
                ? "url"
                : field.type === "email"
                  ? "email"
                  : "text"
            }
            value={str}
            onChange={(e) => onChange(e.currentTarget.value)}
            disabled={disabled}
            required={field.required}
          />
        </FieldWrap>
      );

    case "textarea":
      return (
        <FieldWrap field={field}>
          <Textarea
            value={str}
            onChange={(e) => onChange(e.currentTarget.value)}
            disabled={disabled}
            rows={4}
          />
        </FieldWrap>
      );

    case "richText":
      return (
        <FieldWrap field={field}>
          <Textarea
            value={str}
            onChange={(e) => onChange(e.currentTarget.value)}
            disabled={disabled}
            rows={6}
            placeholder="Rich text (plain text editor — Tiptap coming in a later milestone)"
          />
        </FieldWrap>
      );

    case "number":
      return (
        <FieldWrap field={field}>
          <Input
            type="number"
            value={num}
            onChange={(e) => onChange(Number(e.currentTarget.value))}
            disabled={disabled}
            required={field.required}
          />
        </FieldWrap>
      );

    case "boolean":
      return (
        <FieldWrap field={field} inline>
          <input
            type="checkbox"
            checked={bool}
            onChange={(e) => onChange(e.currentTarget.checked)}
            disabled={disabled}
            className="h-4 w-4 rounded border-border"
          />
        </FieldWrap>
      );

    case "date":
      return (
        <FieldWrap field={field}>
          <Input
            type="date"
            value={str}
            onChange={(e) => onChange(e.currentTarget.value)}
            disabled={disabled}
          />
        </FieldWrap>
      );

    case "dateTime":
      return (
        <FieldWrap field={field}>
          <Input
            type="datetime-local"
            value={str}
            onChange={(e) => onChange(e.currentTarget.value)}
            disabled={disabled}
          />
        </FieldWrap>
      );

    case "time":
      return (
        <FieldWrap field={field}>
          <Input
            type="time"
            value={str}
            onChange={(e) => onChange(e.currentTarget.value)}
            disabled={disabled}
          />
        </FieldWrap>
      );

    case "color":
      return (
        <FieldWrap field={field}>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={str || "#000000"}
              onChange={(e) => onChange(e.currentTarget.value)}
              disabled={disabled}
              className="h-9 w-14 cursor-pointer rounded border border-input p-0.5"
            />
            <Input
              value={str}
              onChange={(e) => onChange(e.currentTarget.value)}
              disabled={disabled}
              className="font-mono w-32"
              placeholder="#000000"
            />
          </div>
        </FieldWrap>
      );

    case "select": {
      const cfg = field.config as {
        options?: Array<{ label: string; value: string }>;
      };
      const opts = cfg.options ?? [];
      return (
        <FieldWrap field={field}>
          <select
            value={str}
            onChange={(e) => onChange(e.currentTarget.value)}
            disabled={disabled}
            required={field.required}
            className={inputClass}
          >
            <option value="">Select…</option>
            {opts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FieldWrap>
      );
    }

    case "multiSelect": {
      const cfg = field.config as {
        options?: Array<{ label: string; value: string }>;
      };
      const opts = cfg.options ?? [];
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <FieldWrap field={field}>
          <div className="flex flex-wrap gap-2">
            {opts.map((o) => {
              const checked = selected.includes(o.value);
              return (
                <label
                  key={o.value}
                  className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm transition-colors hover:bg-accent/30"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = e.currentTarget.checked
                        ? [...selected, o.value]
                        : selected.filter((v) => v !== o.value);
                      onChange(next);
                    }}
                    className="h-3.5 w-3.5"
                  />
                  {o.label}
                </label>
              );
            })}
          </div>
        </FieldWrap>
      );
    }

    case "group": {
      const cfg = field.config as { fields?: FieldDefinition[] };
      const groupFields = cfg.fields ?? [];
      const groupValue = (
        typeof value === "object" && value !== null ? value : {}
      ) as Record<string, unknown>;

      return (
        <FieldWrap field={field}>
          <div className="rounded-md border border-border bg-muted/20 p-4 flex flex-col gap-4">
            {groupFields.map((f) => (
              <FieldRenderer
                key={f.id}
                field={f}
                value={groupValue[f.key]}
                onChange={(v) => onChange({ ...groupValue, [f.key]: v })}
                disabled={disabled}
              />
            ))}
            {groupFields.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No fields in this group.
              </p>
            )}
          </div>
        </FieldWrap>
      );
    }

    case "repeater": {
      const cfg = field.config as { fields?: FieldDefinition[] };
      const repeaterFields = cfg.fields ?? [];
      const rows = Array.isArray(value)
        ? (value as Record<string, unknown>[])
        : [];

      function addRow() {
        onChange([...rows, {}]);
      }

      function removeRow(i: number) {
        onChange(rows.filter((_, j) => j !== i));
      }

      function updateRow(i: number, updated: Record<string, unknown>) {
        onChange(rows.map((r, j) => (j === i ? updated : r)));
      }

      return (
        <FieldWrap field={field}>
          <div className="flex flex-col gap-3">
            {rows.map((row, i) => (
              <div
                key={i}
                className="relative rounded-md border border-border bg-muted/20 p-4"
              >
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={disabled}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <p className="mb-3 text-xs font-semibold text-muted-foreground">
                  Row {i + 1}
                </p>
                <div className="flex flex-col gap-3">
                  {repeaterFields.map((f) => (
                    <FieldRenderer
                      key={f.id}
                      field={f}
                      value={row[f.key]}
                      onChange={(v) => updateRow(i, { ...row, [f.key]: v })}
                      disabled={disabled}
                    />
                  ))}
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={addRow}
              disabled={disabled}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add row
            </Button>
          </div>
        </FieldWrap>
      );
    }

    case "media":
    case "gallery":
    case "relation":
      return (
        <FieldWrap field={field}>
          <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {field.type === "media" && "Media field — available in Phase 7."}
              {field.type === "gallery" &&
                "Gallery field — available in Phase 7."}
              {field.type === "relation" &&
                "Relation field — available in a later phase."}
            </p>
          </div>
        </FieldWrap>
      );

    default:
      return null;
  }
}

function FieldWrap({
  field,
  children,
  inline = false,
}: {
  field: FieldDefinition;
  children: React.ReactNode;
  inline?: boolean;
}) {
  return (
    <div className={`grid gap-1.5 ${isNestedField(field.type) ? "" : ""}`}>
      <Label
        htmlFor={`field-${field.id}`}
        className={inline ? "flex items-center gap-2 cursor-pointer" : ""}
      >
        {inline && children}
        {field.label}
        {field.required && (
          <span className="ml-1 text-destructive text-xs">*</span>
        )}
        {field.description && (
          <span className="ml-1 font-normal text-muted-foreground text-xs">
            — {field.description}
          </span>
        )}
      </Label>
      {!inline && children}
    </div>
  );
}

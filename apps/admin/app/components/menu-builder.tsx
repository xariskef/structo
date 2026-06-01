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
import type {
  NavigationItemType,
  NavigationLinkTargets,
  NavigationMenuDetail,
  NavigationMenuItem,
  NavigationMenuSummary,
} from "@structo/contracts";
import { cn } from "@structo/ui/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { apiRequest } from "../lib/api";

interface MenuBuilderProps {
  siteId: string;
}

type Item = NavigationMenuItem;

const TYPE_LABELS: Record<NavigationItemType, string> = {
  page: "Page",
  collectionArchive: "Collection archive",
  collectionItem: "Collection item",
  custom: "Custom URL",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function uid(): string {
  return globalThis.crypto.randomUUID();
}

function clone(items: Item[]): Item[] {
  return JSON.parse(JSON.stringify(items)) as Item[];
}

// Depth-first list for rendering, carrying each item's nesting depth.
function flatten(items: Item[], depth = 0): { item: Item; depth: number }[] {
  return items.flatMap((item) => [
    { item, depth },
    ...flatten(item.children ?? [], depth + 1),
  ]);
}

interface Located {
  siblings: Item[];
  index: number;
  parent: Item | null;
}

function locate(
  items: Item[],
  id: string,
  parent: Item | null = null,
): Located | null {
  for (let i = 0; i < items.length; i += 1) {
    const current = items[i]!;
    if (current.id === id) return { siblings: items, index: i, parent };
    const found = locate(current.children ?? [], id, current);
    if (found) return found;
  }
  return null;
}

export function MenuBuilder({ siteId }: MenuBuilderProps) {
  const [menus, setMenus] = useState<NavigationMenuSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [targets, setTargets] = useState<NavigationLinkTargets | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();

  // Create-menu form
  const [showCreate, setShowCreate] = useState(false);
  // Add-item form
  const [addType, setAddType] = useState<NavigationItemType>("page");
  const [addTargetId, setAddTargetId] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [customUrl, setCustomUrl] = useState("");

  useEffect(() => {
    void Promise.all([
      apiRequest<NavigationMenuSummary[]>(
        `/manage/sites/${siteId}/navigation-menus`,
      ),
      apiRequest<NavigationLinkTargets>(
        `/manage/sites/${siteId}/navigation-link-targets`,
      ).catch(() => null),
    ])
      .then(([menuList, linkTargets]) => {
        setMenus(menuList);
        setTargets(linkTargets);
        if (menuList[0]) void selectMenu(menuList[0].id);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  async function selectMenu(menuId: string) {
    setActiveId(menuId);
    setError(undefined);
    const detail = await apiRequest<NavigationMenuDetail>(
      `/manage/sites/${siteId}/navigation-menus/${menuId}`,
    );
    setItems(detail.items);
  }

  async function createMenu(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const data = new FormData(event.currentTarget);
    try {
      const created = await apiRequest<NavigationMenuDetail>(
        `/manage/sites/${siteId}/navigation-menus`,
        {
          method: "POST",
          body: JSON.stringify({
            name: data.get("name"),
            key: data.get("key"),
          }),
        },
      );
      const list = await apiRequest<NavigationMenuSummary[]>(
        `/manage/sites/${siteId}/navigation-menus`,
      );
      setMenus(list);
      setShowCreate(false);
      setItems(created.items);
      setActiveId(created.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to create menu.");
    } finally {
      setBusy(false);
    }
  }

  function addItem() {
    if (addType === "custom") {
      if (!customLabel.trim() || !customUrl.trim()) return;
      setItems((prev) => [
        ...prev,
        {
          id: uid(),
          label: customLabel.trim(),
          type: "custom",
          url: customUrl.trim(),
          target: "_self",
          children: [],
        },
      ]);
      setCustomLabel("");
      setCustomUrl("");
      return;
    }

    const pool =
      addType === "page"
        ? targets?.pages
        : addType === "collectionArchive"
          ? targets?.collectionArchives
          : targets?.collectionItems;
    const target = pool?.find((entry) => entry.id === addTargetId);
    if (!target) return;
    setItems((prev) => [
      ...prev,
      {
        id: uid(),
        label: target.label,
        type: addType,
        url: target.url,
        target: "_self",
        reference: { kind: addType, id: target.id },
        children: [],
      },
    ]);
    setAddTargetId("");
  }

  function mutate(fn: (root: Item[]) => void) {
    setItems((prev) => {
      const next = clone(prev);
      fn(next);
      return next;
    });
  }

  function move(id: string, direction: "up" | "down") {
    mutate((root) => {
      const loc = locate(root, id);
      if (!loc) return;
      const swap = direction === "up" ? loc.index - 1 : loc.index + 1;
      if (swap < 0 || swap >= loc.siblings.length) return;
      [loc.siblings[loc.index], loc.siblings[swap]] = [
        loc.siblings[swap]!,
        loc.siblings[loc.index]!,
      ];
    });
  }

  function indent(id: string) {
    mutate((root) => {
      const loc = locate(root, id);
      if (!loc || loc.index === 0) return;
      const [node] = loc.siblings.splice(loc.index, 1);
      const newParent = loc.siblings[loc.index - 1]!;
      newParent.children = newParent.children ?? [];
      newParent.children.push(node!);
    });
  }

  function outdent(id: string) {
    mutate((root) => {
      const loc = locate(root, id);
      if (!loc || !loc.parent) return;
      const parentLoc = locate(root, loc.parent.id);
      if (!parentLoc) return;
      const [node] = loc.siblings.splice(loc.index, 1);
      parentLoc.siblings.splice(parentLoc.index + 1, 0, node!);
    });
  }

  function removeItem(id: string) {
    mutate((root) => {
      const loc = locate(root, id);
      if (loc) loc.siblings.splice(loc.index, 1);
    });
  }

  function patchItem(id: string, patch: Partial<Item>) {
    mutate((root) => {
      const loc = locate(root, id);
      if (loc) Object.assign(loc.siblings[loc.index]!, patch);
    });
  }

  async function save() {
    if (!activeId) return;
    setBusy(true);
    setError(undefined);
    try {
      const updated = await apiRequest<NavigationMenuDetail>(
        `/manage/sites/${siteId}/navigation-menus/${activeId}`,
        { method: "PATCH", body: JSON.stringify({ items }) },
      );
      setItems(updated.items);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to save menu.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  const rows = flatten(items);
  const targetPool =
    addType === "page"
      ? (targets?.pages ?? [])
      : addType === "collectionArchive"
        ? (targets?.collectionArchives ?? [])
        : addType === "collectionItem"
          ? (targets?.collectionItems ?? [])
          : [];

  return (
    <div>
      {/* Menu selector */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {menus.map((menu) => (
          <button
            key={menu.id}
            type="button"
            onClick={() => void selectMenu(menu.id)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              menu.id === activeId
                ? "border-primary bg-primary/10 font-medium text-foreground"
                : "border-border text-muted-foreground hover:bg-accent/30",
            )}
          >
            {menu.name}
            <span className="ml-1.5 text-xs text-muted-foreground">
              /{menu.key}
            </span>
          </button>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowCreate((v) => !v)}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {showCreate ? "Cancel" : "New menu"}
        </Button>
      </div>

      {showCreate && (
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">New menu</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createMenu} className="flex flex-col gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="menu-name">Name</Label>
                <Input
                  id="menu-name"
                  name="name"
                  placeholder="Footer menu"
                  required
                  onChange={(e) => {
                    const keyInput =
                      e.currentTarget.form?.querySelector<HTMLInputElement>(
                        '[name="key"]',
                      );
                    if (keyInput && !keyInput.dataset.edited)
                      keyInput.value = slugify(e.currentTarget.value);
                  }}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="menu-key">
                  Key{" "}
                  <span className="font-normal text-muted-foreground">
                    (stable identifier, e.g. footer)
                  </span>
                </Label>
                <Input
                  id="menu-key"
                  name="key"
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  required
                  onInput={(e) => {
                    e.currentTarget.dataset.edited = "1";
                  }}
                />
              </div>
              <Button type="submit" size="sm" disabled={busy} className="w-fit">
                Create menu
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {error && (
        <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {activeId && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Item list */}
          <div className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">
                Items{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ({rows.length})
                </span>
              </h2>
              <div className="flex items-center gap-2">
                {saved && (
                  <span className="flex items-center gap-1 text-sm text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                    Saved
                  </span>
                )}
                <Button size="sm" onClick={save} disabled={busy}>
                  {busy && (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  )}
                  Save menu
                </Button>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                No items yet. Add links from the panel.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {rows.map(({ item, depth }) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
                    style={{ marginLeft: `${depth * 1.5}rem` }}
                  >
                    <div className="flex shrink-0 flex-col">
                      <button
                        type="button"
                        title="Move up"
                        onClick={() => move(item.id, "up")}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Move down"
                        onClick={() => move(item.id, "down")}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Input
                        value={item.label}
                        onChange={(e) =>
                          patchItem(item.id, { label: e.currentTarget.value })
                        }
                        className="h-8 text-sm"
                      />
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {TYPE_LABELS[item.type]} · {item.url}
                      </p>
                    </div>
                    <label className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={item.target === "_blank"}
                        onChange={(e) =>
                          patchItem(item.id, {
                            target: e.currentTarget.checked
                              ? "_blank"
                              : "_self",
                          })
                        }
                        className="h-3.5 w-3.5"
                      />
                      New tab
                    </label>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        title="Outdent"
                        onClick={() => outdent(item.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Indent"
                        onClick={() => indent(item.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Remove"
                        onClick={() => removeItem(item.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add link panel */}
          <Card className="lg:col-span-1 lg:sticky lg:top-6 lg:self-start">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Add link</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="add-type" className="text-xs">
                  Type
                </Label>
                <select
                  id="add-type"
                  value={addType}
                  onChange={(e) => {
                    setAddType(e.currentTarget.value as NavigationItemType);
                    setAddTargetId("");
                  }}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="page">Page</option>
                  <option value="collectionArchive">Collection archive</option>
                  <option value="collectionItem">Collection item</option>
                  <option value="custom">Custom URL</option>
                </select>
              </div>

              {addType === "custom" ? (
                <>
                  <div className="grid gap-1.5">
                    <Label htmlFor="custom-label" className="text-xs">
                      Label
                    </Label>
                    <Input
                      id="custom-label"
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.currentTarget.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="custom-url" className="text-xs">
                      URL
                    </Label>
                    <Input
                      id="custom-url"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.currentTarget.value)}
                      placeholder="https://… or /path"
                      className="h-9"
                    />
                  </div>
                </>
              ) : (
                <div className="grid gap-1.5">
                  <Label htmlFor="add-target" className="text-xs">
                    {TYPE_LABELS[addType]}
                  </Label>
                  <select
                    id="add-target"
                    value={addTargetId}
                    onChange={(e) => setAddTargetId(e.currentTarget.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select…</option>
                    {targetPool.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.label} ({entry.url})
                      </option>
                    ))}
                  </select>
                  {targetPool.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Nothing published yet for this type.
                    </p>
                  )}
                </div>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={addItem}
                disabled={
                  addType === "custom"
                    ? !customLabel.trim() || !customUrl.trim()
                    : !addTargetId
                }
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add to menu
              </Button>
              <p className="text-[11px] text-muted-foreground">
                New items are added at the end. Use the arrows to reorder and
                the chevrons to nest under the item above.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

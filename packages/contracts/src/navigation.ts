import { z } from "zod";

const menuKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Key must be lowercase letters, numbers and hyphens.",
  );

export const navigationItemTypeSchema = z.enum([
  "page",
  "collectionArchive",
  "collectionItem",
  "custom",
]);
export type NavigationItemType = z.infer<typeof navigationItemTypeSchema>;

export const navigationTargetSchema = z.enum(["_self", "_blank"]);
export type NavigationTarget = z.infer<typeof navigationTargetSchema>;

// A link an item points at. `reference` records the linked content so the
// delivery API can re-resolve the URL later; custom links carry only a URL.
const navigationReferenceSchema = z.object({
  kind: z.enum(["page", "collectionArchive", "collectionItem"]),
  id: z.string().min(1),
});

export interface NavigationMenuItem {
  id: string;
  label: string;
  type: NavigationItemType;
  url: string;
  target: NavigationTarget;
  reference?: {
    kind: "page" | "collectionArchive" | "collectionItem";
    id: string;
  };
  children: NavigationMenuItem[];
}

export const navigationMenuItemSchema: z.ZodType<NavigationMenuItem> = z.lazy(
  () =>
    z.object({
      id: z.string().min(1),
      label: z.string().min(1).max(100),
      type: navigationItemTypeSchema,
      url: z.string().min(1).max(2000),
      target: navigationTargetSchema.default("_self"),
      reference: navigationReferenceSchema.optional(),
      children: z.array(navigationMenuItemSchema).default([]),
    }),
);

const MAX_DEPTH = 5;
const MAX_ITEMS = 200;

function inspectTree(
  items: NavigationMenuItem[],
  depth: number,
  state: { count: number; tooDeep: boolean },
): void {
  if (depth > MAX_DEPTH) {
    state.tooDeep = true;
    return;
  }
  for (const item of items) {
    state.count += 1;
    inspectTree(item.children ?? [], depth + 1, state);
  }
}

export const navigationItemsSchema = z
  .array(navigationMenuItemSchema)
  .superRefine((items, ctx) => {
    const state = { count: 0, tooDeep: false };
    inspectTree(items, 1, state);
    if (state.tooDeep) {
      ctx.addIssue({
        code: "custom",
        message: `Menu nesting cannot exceed ${MAX_DEPTH} levels.`,
      });
    }
    if (state.count > MAX_ITEMS) {
      ctx.addIssue({
        code: "custom",
        message: `A menu cannot hold more than ${MAX_ITEMS} items.`,
      });
    }
  });

export const createNavigationMenuSchema = z.object({
  name: z.string().min(1).max(100),
  key: menuKeySchema,
});

export const updateNavigationMenuSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  items: navigationItemsSchema.optional(),
});

export type CreateNavigationMenuInput = z.infer<
  typeof createNavigationMenuSchema
>;
export type UpdateNavigationMenuInput = z.infer<
  typeof updateNavigationMenuSchema
>;

export interface NavigationMenuSummary {
  id: string;
  siteId: string;
  name: string;
  key: string;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NavigationMenuDetail extends NavigationMenuSummary {
  items: NavigationMenuItem[];
}

export interface NavigationLinkTarget {
  id: string;
  label: string;
  url: string;
}

export interface NavigationLinkTargets {
  pages: NavigationLinkTarget[];
  collectionArchives: NavigationLinkTarget[];
  collectionItems: NavigationLinkTarget[];
}

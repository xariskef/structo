// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export interface ListMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface List<T> {
  data: T[];
  meta: ListMeta;
}

// ---------------------------------------------------------------------------
// Site settings
// ---------------------------------------------------------------------------

export interface SiteSettings {
  name: string;
  slug: string;
  defaultLocale: string | null;
  timezone: string | null;
  publicBaseUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  brandName: string | null;
}

// ---------------------------------------------------------------------------
// Content types
// ---------------------------------------------------------------------------

export interface ContentType {
  kind: "COLLECTION" | "SINGLE";
  slug: string;
  name: string;
  singularName: string;
  pluralName: string;
  description: string | null;
  /** Raw field definition array as stored; shape depends on field types. */
  fields: unknown[];
  taxonomies: ("CATEGORY" | "TAG")[];
}

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

export interface Term {
  kind: "CATEGORY" | "TAG";
  name: string;
  slug: string;
}

export interface MediaAsset {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  caption: string | null;
}

export interface Entry {
  contentTypeSlug: string;
  title: string;
  slug: string;
  /** Structured field data. Media fields are hydrated to MediaAsset objects. */
  data: Record<string, unknown>;
  excerpt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  updatedAt: string;
  terms: Term[];
}

export type EntryList = List<Entry>;

// ---------------------------------------------------------------------------
// Navigation menus
// ---------------------------------------------------------------------------

export interface MenuItem {
  label: string;
  url: string;
  target: "_self" | "_blank";
  children: MenuItem[];
}

export interface Menu {
  key: string;
  name: string;
  items: MenuItem[];
}

// ---------------------------------------------------------------------------
// Query options
// ---------------------------------------------------------------------------

export type EntrySort =
  | "publishedAt:desc"
  | "publishedAt:asc"
  | "title:asc"
  | "title:desc";

export interface ListEntriesOptions {
  page?: number;
  pageSize?: number;
  sort?: EntrySort;
  /** Filter by category slug */
  category?: string;
  /** Filter by tag slug */
  tag?: string;
}

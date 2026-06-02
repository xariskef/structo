import { buildQuery, request } from "./http.js";
import { StructoAuthError } from "./errors.js";
import type {
  ContentType,
  Entry,
  EntryList,
  ListEntriesOptions,
  Menu,
  SiteSettings,
} from "./types.js";

export interface StructoClientOptions {
  /**
   * Base URL of the Structo API, e.g. `https://cms.example.com/api/v1`.
   * Trailing slash is optional.
   */
  baseUrl: string;
  /**
   * Site key as configured in the CMS, e.g. `my-blog`.
   */
  siteKey: string;
  /**
   * Delivery API token (`stk_…`).
   * Required for all standard delivery calls.
   */
  token: string;
  /**
   * Optional preview token (`stp_…`).
   * When provided, `getEntryDraft()` is available.
   */
  previewToken?: string;
}

/**
 * Official Structo CMS Delivery API client.
 *
 * Zero runtime dependencies — uses the platform-native `fetch` API.
 * Compatible with Node.js 18+, browsers, and edge runtimes.
 *
 * @example
 * ```ts
 * import { StructoClient } from "@structo/sdk";
 *
 * const client = new StructoClient({
 *   baseUrl: "https://cms.example.com/api/v1",
 *   siteKey: "my-blog",
 *   token: process.env.STRUCTO_DELIVERY_TOKEN!,
 * });
 *
 * const settings = await client.getSettings();
 * const entries  = await client.listEntries("articles");
 * ```
 */
export class StructoClient {
  private readonly baseUrl: string;
  private readonly siteKey: string;
  private readonly token: string;
  private readonly previewToken: string | undefined;

  constructor(options: StructoClientOptions) {
    this.baseUrl = options.baseUrl;
    this.siteKey = options.siteKey;
    this.token = options.token;
    this.previewToken = options.previewToken;
  }

  // ---------------------------------------------------------------------------
  // Site settings
  // ---------------------------------------------------------------------------

  /** Fetch the site's public settings (name, locale, SEO defaults, etc.). */
  getSettings(): Promise<SiteSettings> {
    return this.get(`/delivery/sites/${this.siteKey}/settings`);
  }

  // ---------------------------------------------------------------------------
  // Content types
  // ---------------------------------------------------------------------------

  /** List all active content types for the site. */
  listContentTypes(): Promise<ContentType[]> {
    return this.get(`/delivery/sites/${this.siteKey}/content-types`);
  }

  /** Fetch a single content type by slug. */
  getContentType(typeSlug: string): Promise<ContentType> {
    return this.get(
      `/delivery/sites/${this.siteKey}/content-types/${typeSlug}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Entries
  // ---------------------------------------------------------------------------

  /** List published entries for a collection content type. */
  listEntries(typeSlug: string, options: ListEntriesOptions = {}): Promise<EntryList> {
    const qs = buildQuery({
      page: options.page,
      pageSize: options.pageSize,
      sort: options.sort,
      category: options.category,
      tag: options.tag,
    });
    return this.get(
      `/delivery/sites/${this.siteKey}/content-types/${typeSlug}/entries${qs}`,
    );
  }

  /** Fetch a single published entry by slug. */
  getEntry(typeSlug: string, entrySlug: string): Promise<Entry> {
    return this.get(
      `/delivery/sites/${this.siteKey}/content-types/${typeSlug}/entries/${entrySlug}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Navigation menus
  // ---------------------------------------------------------------------------

  /** List all navigation menus for the site. */
  listMenus(): Promise<Menu[]> {
    return this.get(`/delivery/sites/${this.siteKey}/navigation-menus`);
  }

  /** Fetch a navigation menu by key. */
  getMenu(menuKey: string): Promise<Menu> {
    return this.get(
      `/delivery/sites/${this.siteKey}/navigation-menus/${menuKey}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Preview (draft) — requires a preview token
  // ---------------------------------------------------------------------------

  /**
   * Fetch the live **draft** of an entry using the preview token.
   *
   * Intended for use in Next.js Draft Mode or similar consumer-side preview
   * bridges. The preview token must be passed in
   * `StructoClientOptions.previewToken`.
   *
   * @throws {StructoAuthError} when the preview token is missing.
   * @throws {StructoNotFoundError} when the token is expired, revoked, or the
   *   entry is not found.
   */
  getEntryDraft(entryId: string): Promise<Entry> {
    if (!this.previewToken) {
      throw new StructoAuthError(
        "A preview token is required. Pass `previewToken` in the StructoClientOptions.",
      );
    }
    return this.get(`/preview/entries/${entryId}?preview=${this.previewToken}`);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private get<T>(path: string): Promise<T> {
    return request<T>(this.baseUrl, this.token, path);
  }
}

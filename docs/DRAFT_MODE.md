# Next.js Draft Mode Bridge

This document explains how to connect Structo preview tokens with the
[Next.js Draft Mode](https://nextjs.org/docs/app/building-your-application/configuring/draft-mode)
API so editors can preview unpublished content in a real frontend.

## Overview

```
Editor clicks "Generate preview link"
  → Admin creates preview token  (POST /manage/sites/:siteId/preview-tokens)
  → Admin returns one-time URL   (/api/preview/enable?token=stp_…)
      ↓
Next.js Route Handler reads token → calls Structo validate → sets Draft Mode cookie
  → redirects to content page
      ↓
Content page detects Draft Mode → fetches entry draft via @structo/sdk
      ↓
Editor sees live draft in their browser
```

## 1. Structo side — issue a preview token

The admin UI exposes two surfaces:

- **Entry editor sidebar** — "Generate preview link" generates an
  entry-scoped token. Use this for sharing a specific draft page.
- **Administration > Preview tokens** — creates site-scoped or entry-scoped
  tokens in bulk, lists all active tokens, and allows revocation.

The token has the form `stp_<random>`. The raw value is shown once and must be
copied into the preview URL immediately.

## 2. Next.js side — enable route handler

Create a Route Handler that accepts the token, validates it against Structo,
sets the Draft Mode cookie, and redirects safely.

```ts
// app/api/preview/enable/route.ts
import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

const STRUCTO_API = process.env.STRUCTO_API_URL!; // e.g. https://cms.example.com/api/v1

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const entryId = req.nextUrl.searchParams.get("entryId");
  const redirectTo = req.nextUrl.searchParams.get("redirect") ?? "/";

  if (!token) {
    return new Response("Missing preview token", { status: 400 });
  }

  // Validate that the token is a known Structo preview token.
  // Any valid stp_ token will succeed at the /preview/entries endpoint.
  // We do a lightweight check by fetching the entry draft.
  if (entryId) {
    const check = await fetch(
      `${STRUCTO_API}/preview/entries/${entryId}?preview=${token}`,
    );
    if (!check.ok) {
      return new Response("Invalid or expired preview token", { status: 401 });
    }
  }

  // Enable Next.js Draft Mode — sets an HttpOnly signed cookie.
  (await draftMode()).enable();

  // Store the preview token in a separate HttpOnly cookie so page components
  // can retrieve it without exposing it to client JavaScript.
  const response = new Response(null, {
    status: 307,
    headers: {
      Location: safeRedirect(redirectTo, req.nextUrl.origin),
      "Set-Cookie": `structo_preview=${token}; Path=/; HttpOnly; SameSite=Lax; Secure`,
    },
  });

  return response;
}

/** Prevent open-redirect: only allow paths on the same origin. */
function safeRedirect(value: string, origin: string): string {
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin) return "/";
    return url.pathname + url.search;
  } catch {
    return "/";
  }
}
```

> **Security notes**
> - Always validate the Structo token before enabling Draft Mode.
> - The redirect target is sanitised with `safeRedirect` to prevent open redirects.
> - The `structo_preview` cookie uses `HttpOnly; Secure` — never readable by
>   client-side JavaScript.
> - Draft Mode cookies are signed by Next.js using the deployment secret and
>   cannot be forged.

## 3. Next.js side — disable route handler

Provide a way for editors to exit preview mode:

```ts
// app/api/preview/disable/route.ts
import { draftMode } from "next/headers";
import { type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const redirectTo = req.nextUrl.searchParams.get("redirect") ?? "/";

  (await draftMode()).disable();

  return new Response(null, {
    status: 307,
    headers: {
      Location: safeRedirect(redirectTo, origin),
      // Clear the preview token cookie.
      "Set-Cookie":
        "structo_preview=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0",
    },
  });
}

function safeRedirect(value: string, origin: string): string {
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin) return "/";
    return url.pathname + url.search;
  } catch {
    return "/";
  }
}
```

## 4. Content page — detect draft mode

```ts
// app/articles/[slug]/page.tsx
import { cookies } from "next/headers";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import { StructoClient, StructoNotFoundError } from "@structo/sdk";

const client = new StructoClient({
  baseUrl: process.env.STRUCTO_API_URL!,
  siteKey: process.env.STRUCTO_SITE_KEY!,
  token: process.env.STRUCTO_DELIVERY_TOKEN!,
});

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ entryId?: string }>;
}

export default async function ArticlePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { isEnabled } = await draftMode();

  if (isEnabled) {
    // Draft mode: fetch the live working draft by entryId.
    const { entryId } = await searchParams;
    if (!entryId) notFound();

    const jar = await cookies();
    const previewToken = jar.get("structo_preview")?.value;
    if (!previewToken) notFound();

    const previewClient = new StructoClient({
      baseUrl: process.env.STRUCTO_API_URL!,
      siteKey: process.env.STRUCTO_SITE_KEY!,
      token: process.env.STRUCTO_DELIVERY_TOKEN!,
      previewToken,
    });

    try {
      const entry = await previewClient.getEntryDraft(entryId);
      return <Article entry={entry} isDraft />;
    } catch (err) {
      if (err instanceof StructoNotFoundError) notFound();
      throw err;
    }
  }

  // Normal mode: fetch the published entry by slug.
  try {
    const entry = await client.getEntry("articles", slug);
    return <Article entry={entry} isDraft={false} />;
  } catch (err) {
    if (err instanceof StructoNotFoundError) notFound();
    throw err;
  }
}
```

## 5. Preview URL format

The admin generates a one-time preview URL. Pass it to the frontend enable
handler using these query parameters:

| Parameter  | Required | Description                                        |
| ---------- | -------- | -------------------------------------------------- |
| `token`    | Yes      | The raw `stp_…` preview token                      |
| `entryId`  | No       | Structo entry ID (required for draft validation)   |
| `redirect` | No       | Path to redirect to after enabling Draft Mode      |

**Example:**

```text
https://my-frontend.com/api/preview/enable
  ?token=stp_xxxx
  &entryId=cm8abc123
  &redirect=/articles/my-draft-post?entryId=cm8abc123
```

## 6. Environment variables

Add these to your Next.js project:

```bash
STRUCTO_API_URL=https://cms.example.com/api/v1
STRUCTO_SITE_KEY=my-site
STRUCTO_DELIVERY_TOKEN=stk_…
```

## Token lifecycle

| Event                     | Effect                                             |
| ------------------------- | -------------------------------------------------- |
| Token expires             | `/preview/entries/:entryId` returns `401`          |
| Token revoked in admin UI | `/preview/entries/:entryId` returns `404`          |
| Editor disables Draft Mode | Cookie cleared; subsequent requests use published content |

Preview tokens are short-lived and scoped to one site (or one entry). Revoke
them from **Administration > Preview tokens** when a review is complete.

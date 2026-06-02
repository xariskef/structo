# Next.js Draft Mode Bridge

This guide connects Structo preview tokens to Next.js Draft Mode so an editor
can review draft content in the real frontend.

## Flow

```text
Editor generates a preview link in Structo
  -> Structo creates a short-lived token and returns the frontend enable URL
  -> Next.js validates the token with GET /preview/session
  -> Next.js enables Draft Mode, stores the token in an HttpOnly cookie
  -> Next.js redirects to a clean frontend URL
  -> Server components fetch draft content with @structo/sdk
```

Preview tokens are opaque bearer credentials. The initial frontend enable URL
contains the raw token because the reviewer must enter the preview session.
After validation, redirect immediately to a clean same-origin URL. CMS API calls
send the token in the `Authorization: Bearer <token>` header, never in a query
string.

## Structo Setup

Configure the site's public base URL in site settings. Structo uses it to build:

```text
https://frontend.example.com/api/preview/enable?token=stp_xxxx&entryId=entry-id
```

Entry-scoped tokens include `entryId`. Site-scoped tokens omit it and can be
used to preview any entry in the site. Tokens expire within 24 hours and can be
revoked from **Administration > Preview tokens**.

## Enable Route

Create `app/api/preview/enable/route.ts` in the Next.js frontend:

```ts
import { StructoClient, StructoNotFoundError } from "@structo/sdk";
import { draftMode } from "next/headers";
import { type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const requestedEntryId = req.nextUrl.searchParams.get("entryId");
  const redirectTo = req.nextUrl.searchParams.get("redirect") ?? "/";
  if (!token) return new Response("Missing preview token", { status: 400 });

  const previewClient = new StructoClient({
    baseUrl: process.env.STRUCTO_API_URL!,
    siteKey: process.env.STRUCTO_SITE_KEY!,
    token: process.env.STRUCTO_DELIVERY_TOKEN!,
    previewToken: token,
  });

  try {
    const session = await previewClient.getPreviewSession();
    if (session.entryId && session.entryId !== requestedEntryId) {
      return new Response("Invalid preview scope", { status: 401 });
    }
  } catch (error) {
    if (error instanceof StructoNotFoundError) {
      return new Response("Invalid or expired preview token", { status: 401 });
    }
    throw error;
  }

  (await draftMode()).enable();
  return new Response(null, {
    status: 307,
    headers: {
      Location: safeRedirect(redirectTo, req.nextUrl.origin),
      "Set-Cookie": `structo_preview=${token}; Path=/; HttpOnly; SameSite=Lax; Secure`,
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

Always call `getPreviewSession()` before enabling Draft Mode, including for
site-scoped tokens.

## Content Page

Use the HttpOnly cookie only in server code:

```ts
import { StructoClient, StructoNotFoundError } from "@structo/sdk";
import { cookies, draftMode } from "next/headers";
import { notFound } from "next/navigation";

export default async function ArticlePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { isEnabled } = await draftMode();

  if (isEnabled) {
    const entryId = (await searchParams).entryId;
    const previewToken = (await cookies()).get("structo_preview")?.value;
    if (!entryId || !previewToken) notFound();

    const previewClient = new StructoClient({
      baseUrl: process.env.STRUCTO_API_URL!,
      siteKey: process.env.STRUCTO_SITE_KEY!,
      token: process.env.STRUCTO_DELIVERY_TOKEN!,
      previewToken,
    });
    try {
      return <Article entry={await previewClient.getEntryDraft(entryId)} isDraft />;
    } catch (error) {
      if (error instanceof StructoNotFoundError) notFound();
      throw error;
    }
  }

  const client = new StructoClient({
    baseUrl: process.env.STRUCTO_API_URL!,
    siteKey: process.env.STRUCTO_SITE_KEY!,
    token: process.env.STRUCTO_DELIVERY_TOKEN!,
  });
  return <Article entry={await client.getEntry("articles", slug)} isDraft={false} />;
}
```

## Disable Route

Create `app/api/preview/disable/route.ts`:

```ts
import { draftMode } from "next/headers";

export async function GET() {
  (await draftMode()).disable();
  return new Response(null, {
    status: 307,
    headers: {
      Location: "/",
      "Set-Cookie":
        "structo_preview=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0",
    },
  });
}
```

## Security Checklist

- Generate the preview link from Structo; do not construct CMS query-string URLs.
- Validate every token through `getPreviewSession()` before enabling Draft Mode.
- Redirect immediately from the token-bearing URL to a clean same-origin path.
- Keep the preview token in an `HttpOnly; Secure; SameSite=Lax` cookie.
- Call draft endpoints from server code only.
- Revoke review tokens when they are no longer needed.

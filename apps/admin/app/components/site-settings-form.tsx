"use client";

import { Button } from "@structo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@structo/ui/components/card";
import { Input } from "@structo/ui/components/input";
import { Label } from "@structo/ui/components/label";
import { Separator } from "@structo/ui/components/separator";
import { Textarea } from "@structo/ui/components/textarea";
import { CheckCircle2, Loader2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import type { SiteSettings } from "@structo/contracts";
import { apiRequest } from "../lib/api";

interface SiteSettingsFormProps {
  siteId: string;
}

const LOCALES = [
  { value: "en", label: "English (en)" },
  { value: "el", label: "Greek (el)" },
  { value: "fr", label: "French (fr)" },
  { value: "de", label: "German (de)" },
  { value: "es", label: "Spanish (es)" },
  { value: "it", label: "Italian (it)" },
  { value: "pt", label: "Portuguese (pt)" },
  { value: "nl", label: "Dutch (nl)" },
];

const TIMEZONES = [
  "UTC",
  "Europe/Athens",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Madrid",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Dubai",
  "Australia/Sydney",
];

export function SiteSettingsForm({ siteId }: SiteSettingsFormProps) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    void apiRequest<SiteSettings>(`/manage/sites/${siteId}/settings`)
      .then(setSettings)
      .catch((e: unknown) => {
        setLoadError(
          e instanceof Error ? e.message : "Unable to load settings.",
        );
      });
  }, [siteId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(undefined);
    setSaved(false);

    const data = new FormData(event.currentTarget);

    try {
      const updated = await apiRequest<SiteSettings>(
        `/manage/sites/${siteId}/settings`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: data.get("name") || undefined,
            slug: data.get("slug") || undefined,
            defaultLocale: data.get("defaultLocale") || undefined,
            timezone: data.get("timezone") || undefined,
            publicBaseUrl: data.get("publicBaseUrl") || undefined,
            seoTitle: data.get("seoTitle") || undefined,
            seoDescription: data.get("seoDescription") || undefined,
            brandName: data.get("brandName") || undefined,
          }),
        },
      );

      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to save settings.");
    } finally {
      setIsSaving(false);
    }
  }

  if (loadError) {
    return (
      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {loadError}
      </p>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading settings…
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      {/* General */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">General</CardTitle>
          <CardDescription>
            Basic site identity. Changing the slug may affect existing links.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="name">Site name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={settings.name}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="slug">
              Site slug{" "}
              <span className="font-normal text-muted-foreground">
                (lowercase, hyphens only)
              </span>
            </Label>
            <Input
              id="slug"
              name="slug"
              defaultValue={settings.slug}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="brandName">Brand name</Label>
            <Input
              id="brandName"
              name="brandName"
              defaultValue={settings.brandName ?? ""}
              placeholder="Optional display name for the brand"
            />
          </div>
        </CardContent>
      </Card>

      {/* Locale & Timezone */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Locale &amp; Timezone</CardTitle>
          <CardDescription>
            Default language and time settings for this site.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="defaultLocale">Default locale</Label>
            <select
              id="defaultLocale"
              name="defaultLocale"
              defaultValue={settings.defaultLocale ?? "en"}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {LOCALES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="timezone">Timezone</Label>
            <select
              id="timezone"
              name="timezone"
              defaultValue={settings.timezone ?? "UTC"}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* URLs */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">URLs</CardTitle>
          <CardDescription>
            The public-facing base URL of the frontend that consumes this site.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-1.5">
            <Label htmlFor="publicBaseUrl">Public base URL</Label>
            <Input
              id="publicBaseUrl"
              name="publicBaseUrl"
              type="url"
              defaultValue={settings.publicBaseUrl ?? ""}
              placeholder="https://example.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* SEO Defaults */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">SEO Defaults</CardTitle>
          <CardDescription>
            Fallback title and description when content entries do not specify
            their own.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="seoTitle">
              Default SEO title{" "}
              <span className="font-normal text-muted-foreground">
                (max 70 characters)
              </span>
            </Label>
            <Input
              id="seoTitle"
              name="seoTitle"
              maxLength={70}
              defaultValue={settings.seoTitle ?? ""}
              placeholder="My site — great content every day"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="seoDescription">
              Default meta description{" "}
              <span className="font-normal text-muted-foreground">
                (max 160 characters)
              </span>
            </Label>
            <Textarea
              id="seoDescription"
              name="seoDescription"
              maxLength={160}
              rows={3}
              defaultValue={settings.seoDescription ?? ""}
              placeholder="A short description of your site shown in search results."
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? "Saving…" : "Save settings"}
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-primary">
            <CheckCircle2 className="h-4 w-4" />
            Saved
          </span>
        )}
      </div>
    </form>
  );
}

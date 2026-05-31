import { SiteSettingsForm } from "../../../../components/site-settings-form";

interface SettingsPageProps {
  params: Promise<{ siteId: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { siteId } = await params;

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Settings
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
          Site settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure locale, SEO defaults, and other site properties.
        </p>
      </div>

      <SiteSettingsForm siteId={siteId} />
    </div>
  );
}

import { StorageSettings } from "../../../../components/storage-settings";

interface StoragePageProps {
  params: Promise<{ siteId: string }>;
}

export default async function StoragePage({ params }: StoragePageProps) {
  const { siteId } = await params;

  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Administration
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
          Storage
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure a Cloudflare R2 bucket for this site&apos;s media uploads.
          Leave unconfigured to use the platform default.
        </p>
      </div>
      <StorageSettings siteId={siteId} />
    </div>
  );
}

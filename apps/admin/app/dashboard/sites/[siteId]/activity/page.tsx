import { ActivityLog } from "../../../../components/activity-log";

interface SiteActivityPageProps {
  params: Promise<{ siteId: string }>;
}

export default async function SiteActivityPage({
  params,
}: SiteActivityPageProps) {
  const { siteId } = await params;

  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Administration
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
          Activity
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A read-only record of content and configuration changes on this site.
        </p>
      </div>
      <ActivityLog scope="site" siteId={siteId} />
    </div>
  );
}

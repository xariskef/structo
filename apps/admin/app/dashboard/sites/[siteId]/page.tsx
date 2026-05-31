import { SiteOverview } from "../../../components/site-overview";

interface SiteDashboardPageProps {
  params: Promise<{ siteId: string }>;
}

export default async function SiteDashboardPage({
  params,
}: SiteDashboardPageProps) {
  const { siteId } = await params;

  return (
    <div className="p-8">
      <SiteOverview siteId={siteId} />
    </div>
  );
}

import { OrganizationOverview } from "../../../components/organization-overview";

interface OrganizationDashboardPageProps {
  params: Promise<{ organizationId: string }>;
}

export default async function OrganizationDashboardPage({
  params,
}: OrganizationDashboardPageProps) {
  const { organizationId } = await params;

  return (
    <div className="p-8">
      <OrganizationOverview organizationId={organizationId} />
    </div>
  );
}

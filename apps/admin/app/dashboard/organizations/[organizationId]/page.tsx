import { DashboardShell } from "../../../components/dashboard-shell";
import { OrganizationOverview } from "../../../components/organization-overview";

interface OrganizationDashboardPageProps {
  params: Promise<{ organizationId: string }>;
}

export default async function OrganizationDashboardPage({
  params,
}: OrganizationDashboardPageProps) {
  const { organizationId } = await params;

  return (
    <DashboardShell eyebrow="Organization dashboard" title="Manage sites.">
      <OrganizationOverview organizationId={organizationId} />
    </DashboardShell>
  );
}

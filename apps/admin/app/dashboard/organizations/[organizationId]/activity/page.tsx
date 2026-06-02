import { ActivityLog } from "../../../../components/activity-log";

interface OrganizationActivityPageProps {
  params: Promise<{ organizationId: string }>;
}

export default async function OrganizationActivityPage({
  params,
}: OrganizationActivityPageProps) {
  const { organizationId } = await params;

  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Organization
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
          Activity
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A read-only record of changes across this organization and its sites.
        </p>
      </div>
      <ActivityLog scope="organization" organizationId={organizationId} />
    </div>
  );
}

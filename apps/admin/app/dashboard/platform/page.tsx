import { PlatformOverview } from "../../components/platform-overview";

export default function PlatformOverviewPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-600">
          Platform operator
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
          Overview
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          System-wide counts and recent activity across every organization.
        </p>
      </div>
      <PlatformOverview />
    </div>
  );
}

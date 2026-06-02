import { ActivityLog } from "../../../components/activity-log";

export default function PlatformActivityPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-600">
          Platform operator
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
          Activity
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Newest-first audit events across every organization and site.
        </p>
      </div>
      <ActivityLog scope="platform" />
    </div>
  );
}

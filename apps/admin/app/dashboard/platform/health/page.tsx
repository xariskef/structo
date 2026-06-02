import { PlatformHealth } from "../../../components/platform-health";

export default function PlatformHealthPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-600">
          Platform operator
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">Health</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A restricted, high-level view of database reachability and system
          counts.
        </p>
      </div>
      <PlatformHealth />
    </div>
  );
}

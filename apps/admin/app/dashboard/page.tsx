import { DashboardShell } from "../components/dashboard-shell";

export default function DashboardPage() {
  return (
    <DashboardShell eyebrow="Dashboard" title="Choose your workspace.">
      <p className="intro">
        Open an organization to manage its sites, or enter a site directly from
        the sidebar.
      </p>
    </DashboardShell>
  );
}

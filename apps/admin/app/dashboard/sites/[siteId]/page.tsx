import { DashboardShell } from "../../../components/dashboard-shell";
import { SiteOverview } from "../../../components/site-overview";

const cards = [
  "Site settings",
  "Content types",
  "Content entries",
  "Site members",
];

interface SiteDashboardPageProps {
  params: Promise<{ siteId: string }>;
}

export default async function SiteDashboardPage({
  params,
}: SiteDashboardPageProps) {
  const { siteId } = await params;

  return (
    <DashboardShell eyebrow="Site dashboard" title="Site workspace.">
      <SiteOverview siteId={siteId} />
      <section aria-label="Site areas">
        {cards.map((card) => (
          <article key={card}>
            <h2>{card}</h2>
            <p>Ready for the next implementation milestone.</p>
          </article>
        ))}
      </section>
    </DashboardShell>
  );
}

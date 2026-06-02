import { ApiTokensManager } from "../../../../components/api-tokens-manager";

interface ApiTokensPageProps {
  params: Promise<{ siteId: string }>;
}

export default async function ApiTokensPage({ params }: ApiTokensPageProps) {
  const { siteId } = await params;

  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Administration
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
          API tokens
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Issue site-scoped read-only credentials for external frontend
          projects.
        </p>
      </div>
      <ApiTokensManager siteId={siteId} />
    </div>
  );
}

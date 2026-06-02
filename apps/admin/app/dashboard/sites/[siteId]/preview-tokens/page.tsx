import { PreviewTokensManager } from "../../../../components/preview-tokens-manager";

interface PreviewTokensPageProps {
  params: Promise<{ siteId: string }>;
}

export default async function PreviewTokensPage({
  params,
}: PreviewTokensPageProps) {
  const { siteId } = await params;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Preview tokens
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Short-lived tokens that grant access to draft content. Useful for
          sharing unpublished pages with reviewers or connected frontends.
        </p>
      </div>
      <PreviewTokensManager siteId={siteId} />
    </div>
  );
}

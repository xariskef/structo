import { TaxonomyManager } from "../../../../components/taxonomy-manager";

interface TagsPageProps {
  params: Promise<{ siteId: string }>;
}

export default async function TagsPage({ params }: TagsPageProps) {
  const { siteId } = await params;
  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Content
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
          Page tags
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage reusable flat labels shared by standalone pages.
        </p>
      </div>
      <TaxonomyManager siteId={siteId} scope="PAGES" kind="TAG" />
    </div>
  );
}

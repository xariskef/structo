import { TaxonomyManager } from "../../../../components/taxonomy-manager";

interface CategoriesPageProps {
  params: Promise<{ siteId: string }>;
}

export default async function CategoriesPage({ params }: CategoriesPageProps) {
  const { siteId } = await params;
  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Content
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
          Page categories
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Organize standalone pages with shared hierarchical categories.
        </p>
      </div>
      <TaxonomyManager siteId={siteId} scope="PAGES" kind="CATEGORY" />
    </div>
  );
}

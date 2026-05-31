import { CollectionView } from "../../../../../components/collection-view";

interface CollectionPageProps {
  params: Promise<{ siteId: string; contentTypeId: string }>;
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { siteId, contentTypeId } = await params;

  return (
    <div className="p-8">
      <CollectionView siteId={siteId} contentTypeId={contentTypeId} />
    </div>
  );
}

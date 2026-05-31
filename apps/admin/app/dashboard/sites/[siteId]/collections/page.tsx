import { CollectionsList } from "../../../../components/collections-list";

interface CollectionsPageProps {
  params: Promise<{ siteId: string }>;
}

export default async function CollectionsPage({
  params,
}: CollectionsPageProps) {
  const { siteId } = await params;

  return (
    <div className="p-8">
      <CollectionsList siteId={siteId} />
    </div>
  );
}

import { EntryEditor } from "../../../../../../../components/entry-editor";

interface CollectionItemPageProps {
  params: Promise<{ siteId: string; contentTypeId: string; entryId: string }>;
}

export default async function CollectionItemPage({
  params,
}: CollectionItemPageProps) {
  const { siteId, contentTypeId, entryId } = await params;

  return (
    <div className="p-8">
      <EntryEditor
        siteId={siteId}
        entryId={entryId}
        backHref={`/dashboard/sites/${siteId}/collections/${contentTypeId}`}
      />
    </div>
  );
}

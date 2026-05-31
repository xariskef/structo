import { EntryEditor } from "../../../../../components/entry-editor";

interface EntryPageProps {
  params: Promise<{ siteId: string; entryId: string }>;
}

export default async function EntryPage({ params }: EntryPageProps) {
  const { siteId, entryId } = await params;

  return (
    <div className="p-8">
      <EntryEditor siteId={siteId} entryId={entryId} />
    </div>
  );
}

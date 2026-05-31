import { EntriesList } from "../../../../components/entries-list";

interface EntriesPageProps {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ contentTypeId?: string }>;
}

export default async function EntriesPage({
  params,
  searchParams,
}: EntriesPageProps) {
  const { siteId } = await params;
  const { contentTypeId } = await searchParams;

  return (
    <div className="p-8">
      <EntriesList siteId={siteId} contentTypeId={contentTypeId} />
    </div>
  );
}

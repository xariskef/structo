import { ContentTypesList } from "../../../../components/content-types-list";

interface ContentTypesPageProps {
  params: Promise<{ siteId: string }>;
}

export default async function ContentTypesPage({
  params,
}: ContentTypesPageProps) {
  const { siteId } = await params;

  return (
    <div className="p-8">
      <ContentTypesList siteId={siteId} />
    </div>
  );
}

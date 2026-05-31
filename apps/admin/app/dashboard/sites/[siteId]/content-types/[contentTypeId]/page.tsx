import { ContentTypeEditor } from "../../../../../components/content-type-editor";

interface ContentTypePageProps {
  params: Promise<{ siteId: string; contentTypeId: string }>;
}

export default async function ContentTypePage({
  params,
}: ContentTypePageProps) {
  const { siteId, contentTypeId } = await params;

  return (
    <div className="p-8">
      <ContentTypeEditor siteId={siteId} contentTypeId={contentTypeId} />
    </div>
  );
}

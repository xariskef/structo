import { PageView } from "../../../../../components/page-view";

interface SinglePageProps {
  params: Promise<{ siteId: string; contentTypeId: string }>;
}

export default async function SinglePage({ params }: SinglePageProps) {
  const { siteId, contentTypeId } = await params;

  return (
    <div className="p-8">
      <PageView siteId={siteId} contentTypeId={contentTypeId} />
    </div>
  );
}

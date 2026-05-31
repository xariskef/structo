import { PagesList } from "../../../../components/pages-list";

interface PagesPageProps {
  params: Promise<{ siteId: string }>;
}

export default async function PagesPage({ params }: PagesPageProps) {
  const { siteId } = await params;

  return (
    <div className="p-8">
      <PagesList siteId={siteId} />
    </div>
  );
}

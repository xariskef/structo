import { MediaManager } from "../../../../components/media-manager";

export default async function MediaPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  return <MediaManager siteId={siteId} />;
}

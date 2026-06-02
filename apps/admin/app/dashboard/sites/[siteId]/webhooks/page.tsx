import { WebhooksManager } from "../../../../components/webhooks-manager";

interface WebhooksPageProps {
  params: Promise<{ siteId: string }>;
}

export default async function WebhooksPage({ params }: WebhooksPageProps) {
  const { siteId } = await params;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Receive HTTP POST notifications when content is published,
          unpublished, deleted, or scheduled. Each request is signed with an
          HMAC-SHA256 secret so your endpoint can verify its authenticity.
        </p>
      </div>
      <WebhooksManager siteId={siteId} />
    </div>
  );
}

import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  WEBHOOK_EVENTS,
  type CreateWebhookInput,
  type UpdateWebhookInput,
  type WebhookCreated,
  type WebhookEvent,
  type WebhookPayload,
  type WebhookSummary,
} from "@structo/contracts";
import { createHmac, randomBytes } from "node:crypto";

import { AuthorizationService } from "../authorization/authorization.service.js";
import { DatabaseService } from "../database/database.service.js";

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
    @Inject(AuthorizationService)
    private readonly authorizationService: AuthorizationService,
  ) {}

  async list(userId: string, siteId: string): Promise<WebhookSummary[]> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_webhooks",
    );
    await this.findSite(siteId);
    const rows = await this.db.client.webhook.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.toSummary(r));
  }

  async create(
    userId: string,
    siteId: string,
    input: CreateWebhookInput,
  ): Promise<WebhookCreated> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_webhooks",
    );
    await this.findSite(siteId);

    const secret = `whsec_${randomBytes(32).toString("base64url")}`;

    const row = await this.db.client.$transaction(async (tx) => {
      const webhook = await tx.webhook.create({
        data: {
          siteId,
          label: input.label,
          url: input.url,
          secret,
          events: input.events as string[],
          enabled: true,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: (await this.findSite(siteId)).organizationId,
          siteId,
          actorId: userId,
          action: "webhook.create",
          entityType: "Webhook",
          entityId: webhook.id,
          metadata: { label: input.label, url: input.url },
        },
      });
      return webhook;
    });

    return { ...this.toSummary(row), secret };
  }

  async update(
    userId: string,
    siteId: string,
    webhookId: string,
    input: UpdateWebhookInput,
  ): Promise<WebhookSummary> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_webhooks",
    );
    const existing = await this.findWebhook(siteId, webhookId);

    const updated = await this.db.client.webhook.update({
      where: { id: webhookId },
      data: {
        label: input.label ?? existing.label,
        url: input.url ?? existing.url,
        events: (input.events as string[] | undefined) ?? existing.events,
        enabled: input.enabled ?? existing.enabled,
      },
    });
    return this.toSummary(updated);
  }

  async delete(
    userId: string,
    siteId: string,
    webhookId: string,
  ): Promise<void> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_webhooks",
    );
    const site = await this.findSite(siteId);
    const existing = await this.findWebhook(siteId, webhookId);

    await this.db.client.$transaction([
      this.db.client.webhook.delete({ where: { id: webhookId } }),
      this.db.client.auditLog.create({
        data: {
          organizationId: site.organizationId,
          siteId,
          actorId: userId,
          action: "webhook.delete",
          entityType: "Webhook",
          entityId: webhookId,
          metadata: { label: existing.label },
        },
      }),
    ]);
  }

  async sendTestPing(
    userId: string,
    siteId: string,
    webhookId: string,
  ): Promise<void> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_webhooks",
    );
    const site = await this.findSite(siteId);
    const hook = await this.findWebhook(siteId, webhookId);

    const testPayload: WebhookPayload = {
      event: "entry.published",
      siteKey: site.key,
      timestamp: new Date().toISOString(),
      data: {
        id: "test-id",
        contentTypeSlug: "test",
        slug: "test-ping",
        title: "Test Ping",
        status: "published",
      },
    };
    await this.sendOne(hook, "entry.published", JSON.stringify(testPayload));
  }

  /**
   * Fire-and-forget: dispatch a webhook event to all enabled matching webhooks
   * for the site. Never throws — failures are logged only.
   */
  dispatch(
    siteKey: string,
    siteId: string,
    event: WebhookEvent,
    data: WebhookPayload["data"],
  ): void {
    void this.dispatchAsync(siteKey, siteId, event, data);
  }

  private async dispatchAsync(
    siteKey: string,
    siteId: string,
    event: WebhookEvent,
    data: WebhookPayload["data"],
  ): Promise<void> {
    const hooks = await this.db.client.webhook.findMany({
      where: { siteId, enabled: true, events: { has: event } },
    });

    if (hooks.length === 0) return;

    const payload: WebhookPayload = {
      event,
      siteKey,
      timestamp: new Date().toISOString(),
      data,
    };
    const body = JSON.stringify(payload);

    await Promise.allSettled(
      hooks.map((hook) => this.sendOne(hook, event, body)),
    );
  }

  private async sendOne(
    hook: { id: string; url: string; secret: string },
    event: WebhookEvent,
    body: string,
  ): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", hook.secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");

    let ok = false;
    try {
      const response = await fetch(hook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Structo-Event": event,
          "X-Structo-Timestamp": timestamp,
          "X-Structo-Signature": `sha256=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      ok = response.ok;
      if (!ok) {
        this.logger.warn(
          `Webhook ${hook.id} responded ${response.status} for event ${event}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Webhook ${hook.id} delivery failed for event ${event}: ${String(err)}`,
      );
    }

    // Best-effort status update — never block the main flow
    this.db.client.webhook
      .update({
        where: { id: hook.id },
        data: { lastTriggeredAt: new Date(), lastDeliveryOk: ok },
      })
      .catch(() => {});
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async findSite(siteId: string) {
    const site = await this.db.client.site.findUnique({
      where: { id: siteId },
      select: { id: true, key: true, organizationId: true },
    });
    if (!site) throw new NotFoundException("Site not found.");
    return site;
  }

  private async findWebhook(siteId: string, webhookId: string) {
    const hook = await this.db.client.webhook.findUnique({
      where: { id: webhookId },
    });
    if (!hook || hook.siteId !== siteId)
      throw new NotFoundException("Webhook not found.");
    return hook;
  }

  private validateEvents(events: string[]): asserts events is WebhookEvent[] {
    const invalid = events.filter(
      (e) => !(WEBHOOK_EVENTS as readonly string[]).includes(e),
    );
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Unknown webhook events: ${invalid.join(", ")}`,
      );
    }
  }

  private toSummary(row: {
    id: string;
    label: string;
    url: string;
    events: string[];
    enabled: boolean;
    lastTriggeredAt: Date | null;
    lastDeliveryOk: boolean | null;
    createdAt: Date;
  }): WebhookSummary {
    this.validateEvents(row.events);
    return {
      id: row.id,
      label: row.label,
      url: row.url,
      events: row.events as WebhookEvent[],
      enabled: row.enabled,
      lastTriggeredAt: row.lastTriggeredAt?.toISOString() ?? null,
      lastDeliveryOk: row.lastDeliveryOk,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

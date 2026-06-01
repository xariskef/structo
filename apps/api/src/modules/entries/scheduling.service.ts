import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { EntriesService } from "./entries.service.js";

// Promotes scheduled entries to published once their go-live time passes.
@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(
    @Inject(EntriesService)
    private readonly entriesService: EntriesService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async promoteScheduled(): Promise<void> {
    try {
      const promoted = await this.entriesService.promoteDueScheduled();
      if (promoted > 0) {
        this.logger.log(`Published ${promoted} scheduled entr${promoted === 1 ? "y" : "ies"}.`);
      }
    } catch (error) {
      this.logger.error("Failed to promote scheduled entries.", error);
    }
  }
}

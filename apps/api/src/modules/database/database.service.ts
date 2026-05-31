import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { createDatabaseClient, type PrismaClient } from "@structo/database";

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private databaseClient?: PrismaClient;

  get client(): PrismaClient {
    this.databaseClient ??= createDatabaseClient();

    return this.databaseClient;
  }

  async onModuleDestroy(): Promise<void> {
    await this.databaseClient?.$disconnect();
  }
}

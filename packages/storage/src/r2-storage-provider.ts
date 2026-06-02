import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import {
  StorageProviderError,
  type PutObjectInput,
  type StorageProvider,
  type StoredObject,
} from "./storage-provider.js";

interface R2StorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

interface S3CommandClient {
  send(command: PutObjectCommand | DeleteObjectCommand): Promise<unknown>;
}

export class R2StorageProvider implements StorageProvider {
  private readonly client: S3CommandClient;

  constructor(
    private readonly config: R2StorageConfig,
    client?: S3CommandClient,
  ) {
    this.client =
      client ??
      new S3Client({
        region: "auto",
        endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
        forcePathStyle: true,
      });
  }

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    await this.client
      .send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
        }),
      )
      .catch((error: unknown) => this.throwRequestError("PUT", error));
    return { key: input.key, url: this.publicUrl(input.key) };
  }

  async deleteObject(key: string): Promise<void> {
    await this.client
      .send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }))
      .catch((error: unknown) => this.throwRequestError("DELETE", error));
  }

  private publicUrl(key: string): string {
    return `${this.config.publicBaseUrl.replace(/\/+$/, "")}/${encodePath(key)}`;
  }

  private throwRequestError(method: string, error: unknown): never {
    const message = error instanceof Error ? ` ${error.message}` : "";
    throw new StorageProviderError(`R2 ${method} failed.${message}`);
  }
}

export function createR2StorageProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): StorageProvider {
  const required = [
    ["R2_ACCOUNT_ID", env.R2_ACCOUNT_ID],
    ["R2_ACCESS_KEY_ID", env.R2_ACCESS_KEY_ID],
    ["R2_SECRET_ACCESS_KEY", env.R2_SECRET_ACCESS_KEY],
    ["R2_BUCKET", env.R2_BUCKET],
    ["R2_PUBLIC_BASE_URL", env.R2_PUBLIC_BASE_URL],
  ] as const;
  const missing = required.filter(([, value]) => !value).map(([name]) => name);
  if (missing.length > 0) {
    return new UnconfiguredStorageProvider(missing);
  }
  const config = {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
    publicBaseUrl: env.R2_PUBLIC_BASE_URL,
  };
  return new R2StorageProvider(config as R2StorageConfig);
}

class UnconfiguredStorageProvider implements StorageProvider {
  constructor(private readonly missing: string[]) {}

  putObject(): Promise<StoredObject> {
    return Promise.reject(this.error());
  }

  deleteObject(): Promise<void> {
    return Promise.reject(this.error());
  }

  private error(): StorageProviderError {
    return new StorageProviderError(
      `R2 storage is not configured. Missing: ${this.missing.join(", ")}.`,
    );
  }
}

function encodePath(value: string): string {
  return value.split("/").map(encodeURIComponent).join("/");
}

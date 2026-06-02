export interface PutObjectInput {
  key: string;
  body: Uint8Array;
  contentType: string;
}

export interface StoredObject {
  key: string;
  url: string;
}

export interface StorageProvider {
  putObject(input: PutObjectInput): Promise<StoredObject>;
  deleteObject(key: string): Promise<void>;
}

export class StorageProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageProviderError";
  }
}

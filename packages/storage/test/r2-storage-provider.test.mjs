import assert from "node:assert/strict";
import test from "node:test";

import {
  R2StorageProvider,
  StorageProviderError,
  createR2StorageProviderFromEnv,
} from "../dist/index.js";

test("R2 provider sends S3-compatible uploads and returns the public URL", async () => {
  let command;
  const provider = new R2StorageProvider(
    {
      accountId: "account",
      accessKeyId: "key",
      secretAccessKey: "secret",
      bucket: "assets",
      publicBaseUrl: "https://media.example.com",
    },
    {
      send(next) {
        command = next;
        return Promise.resolve({});
      },
    },
  );

  const stored = await provider.putObject({
    key: "sites/site-a/photo one.png",
    body: new Uint8Array([1, 2, 3]),
    contentType: "image/png",
  });

  assert.equal(command.input.Bucket, "assets");
  assert.equal(command.input.Key, "sites/site-a/photo one.png");
  assert.equal(command.input.ContentType, "image/png");
  assert.deepEqual(stored, {
    key: "sites/site-a/photo one.png",
    url: "https://media.example.com/sites/site-a/photo%20one.png",
  });
});

test("unconfigured R2 provider fails only when storage is used", async () => {
  const provider = createR2StorageProviderFromEnv({});
  await assert.rejects(
    provider.deleteObject("sites/site-a/file.png"),
    (error) =>
      error instanceof StorageProviderError &&
      error.message.includes("R2_ACCOUNT_ID"),
  );
});

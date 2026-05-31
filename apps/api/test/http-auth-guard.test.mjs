import assert from "node:assert/strict";
import { test } from "node:test";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "../dist/app.module.js";

test("public health route bypasses auth while management routes require a session", async (t) => {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("api/v1");
  await app.listen(0, "127.0.0.1");

  t.after(async () => {
    await app.close();
  });

  const address = app.getHttpServer().address();
  assert.ok(address && typeof address !== "string");

  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  const healthResponse = await fetch(`${baseUrl}/health`);
  const protectedResponse = await fetch(`${baseUrl}/manage/organizations`);

  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), {
    service: "structo-api",
    status: "ok",
  });
  assert.equal(protectedResponse.status, 401);
});

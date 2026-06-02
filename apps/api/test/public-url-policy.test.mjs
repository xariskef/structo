import assert from "node:assert/strict";
import test from "node:test";

import { BadRequestException } from "@nestjs/common";

import { assertSafePublicBaseUrl } from "../dist/modules/site-storage/public-url-policy.js";

test("storage public URL policy accepts an HTTPS host with public addresses", async () => {
  await assertSafePublicBaseUrl("https://media.example.com", async () => [
    "1.1.1.1",
    "2606:4700:4700::1111",
  ]);
});

test("storage public URL policy rejects HTTP, credentials and custom ports", async () => {
  const resolve = async () => ["1.1.1.1"];
  await assert.rejects(
    assertSafePublicBaseUrl("http://media.example.com", resolve),
    BadRequestException,
  );
  await assert.rejects(
    assertSafePublicBaseUrl("https://user:pass@media.example.com", resolve),
    BadRequestException,
  );
  await assert.rejects(
    assertSafePublicBaseUrl("https://media.example.com:8443", resolve),
    BadRequestException,
  );
});

test("storage public URL policy rejects local and private resolved addresses", async () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "::1",
    "fd00::1",
    "fe80::1",
    "ff02::1",
    "::ffff:172.16.0.1",
  ]) {
    await assert.rejects(
      assertSafePublicBaseUrl("https://media.example.com", async () => [
        address,
      ]),
      BadRequestException,
    );
  }
});

test("storage public URL policy strips brackets from direct IPv6 hostnames", async () => {
  let resolvedHostname;
  await assertSafePublicBaseUrl(
    "https://[2606:4700:4700::1111]",
    async (hostname) => {
      resolvedHostname = hostname;
      return [hostname];
    },
  );
  assert.equal(resolvedHostname, "2606:4700:4700::1111");
});

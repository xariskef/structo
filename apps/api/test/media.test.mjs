import assert from "node:assert/strict";
import test from "node:test";

import { BadRequestException, NotFoundException } from "@nestjs/common";

import {
  assertAllowedMediaFile,
  readImageDimensions,
} from "../dist/modules/media/media-file.js";
import { assertSiteMediaAssets } from "../dist/modules/media/media-references.js";
import { MediaService } from "../dist/modules/media/media.service.js";

function png(width = 2, height = 3) {
  const buffer = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function authorization() {
  return { assertSitePermission() {} };
}

test("media files are checked by signature and expose image dimensions", () => {
  const buffer = png();
  assert.equal(
    assertAllowedMediaFile({
      originalname: "photo.png",
      mimetype: "image/png",
      size: buffer.length,
      buffer,
    }),
    "image/png",
  );
  assert.deepEqual(readImageDimensions(buffer, "image/png"), {
    width: 2,
    height: 3,
  });
  assert.throws(
    () =>
      assertAllowedMediaFile({
        originalname: "fake.png",
        mimetype: "image/png",
        size: 4,
        buffer: Buffer.from("nope"),
      }),
    (error) => error instanceof BadRequestException,
  );
});

test("media upload stores metadata and an audit event", async () => {
  let createData;
  let auditData;
  const storage = {
    putObject({ key }) {
      return Promise.resolve({ key, url: `https://media.example.com/${key}` });
    },
    deleteObject() {
      return Promise.resolve();
    },
  };
  const client = {
    site: {
      findUnique() {
        return { organizationId: "org-a" };
      },
    },
    $transaction(callback) {
      return callback({
        mediaAsset: {
          create({ data }) {
            createData = data;
            return {
              id: "asset-a",
              ...data,
              alt: null,
              caption: null,
              createdAt: new Date("2026-06-02T00:00:00.000Z"),
              updatedAt: new Date("2026-06-02T00:00:00.000Z"),
            };
          },
        },
        auditLog: {
          create({ data }) {
            auditData = data;
            return {};
          },
        },
      });
    },
  };
  const service = new MediaService({ client }, authorization(), storage);
  const buffer = png();

  const asset = await service.upload("u", "site-a", {
    originalname: "../photo.png",
    mimetype: "image/png",
    size: buffer.length,
    buffer,
  });

  assert.equal(asset.filename, "photo.png");
  assert.equal(asset.width, 2);
  assert.equal(asset.height, 3);
  assert.equal(createData.storageProvider, "r2");
  assert.match(createData.storageKey, /^sites\/site-a\/\d{4}\/\d{2}\//);
  assert.equal(auditData.action, "media.upload");
});

test("media delete rejects ids from another site", async () => {
  const client = {
    site: {
      findUnique() {
        return { organizationId: "org-a" };
      },
    },
    mediaAsset: {
      findUnique() {
        return { id: "asset-a", siteId: "site-b" };
      },
    },
  };
  const service = new MediaService({ client }, authorization(), {});
  await assert.rejects(
    service.remove("u", "site-a", "asset-a"),
    (error) => error instanceof NotFoundException,
  );
});

test("media delete rejects assets still referenced by content", async () => {
  let storageDeleted = false;
  const client = {
    site: {
      findUnique() {
        return { organizationId: "org-a" };
      },
    },
    mediaAsset: {
      findUnique() {
        return {
          id: "asset-a",
          siteId: "site-a",
          storageKey: "sites/site-a/photo.png",
        };
      },
    },
    contentEntry: {
      findMany() {
        return [{ data: { hero: "asset-a" } }];
      },
    },
    taxonomyTerm: {
      findMany() {
        return [];
      },
    },
  };
  const storage = {
    deleteObject() {
      storageDeleted = true;
      return Promise.resolve();
    },
  };
  const service = new MediaService({ client }, authorization(), storage);

  await assert.rejects(
    service.remove("u", "site-a", "asset-a"),
    (error) => error instanceof BadRequestException,
  );
  assert.equal(storageDeleted, false);
});

test("dynamic media references reject assets from another site", async () => {
  const fields = [
    {
      id: "gallery",
      type: "gallery",
      key: "gallery",
      label: "Gallery",
      required: false,
      config: {},
    },
  ];
  const db = {
    client: {
      mediaAsset: {
        count({ where }) {
          assert.deepEqual(where, {
            siteId: "site-a",
            id: { in: ["asset-a", "asset-b"] },
          });
          return 1;
        },
      },
    },
  };
  await assert.rejects(
    assertSiteMediaAssets(db, "site-a", fields, {
      gallery: ["asset-a", "asset-b"],
    }),
    (error) => error instanceof BadRequestException,
  );
});

test("dynamic media references recurse through groups and repeater rows", async () => {
  const fields = [
    {
      id: "content",
      type: "group",
      key: "content",
      label: "Content",
      required: false,
      config: {
        fields: [
          {
            id: "slides",
            type: "repeater",
            key: "slides",
            label: "Slides",
            required: false,
            config: {
              fields: [
                {
                  id: "image",
                  type: "media",
                  key: "image",
                  label: "Image",
                  required: false,
                  config: {},
                },
              ],
            },
          },
        ],
      },
    },
  ];
  const db = {
    client: {
      mediaAsset: {
        count({ where }) {
          assert.deepEqual(where.id.in, ["asset-a", "asset-b"]);
          return 2;
        },
      },
    },
  };

  await assert.doesNotReject(
    assertSiteMediaAssets(db, "site-a", fields, {
      content: { slides: [{ image: "asset-a" }, { image: "asset-b" }] },
    }),
  );
});

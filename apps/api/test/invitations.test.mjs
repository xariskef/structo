import assert from "node:assert/strict";
import { test } from "node:test";

import { InvitationsService } from "../dist/modules/invitations/invitations.service.js";

test("accepting a site invitation grants direct site-only membership once", async () => {
  let upsertData;
  let invitationUpdate;

  const invitation = {
    id: "invitation-a",
    email: "editor@example.com",
    organizationId: "organization-a",
    siteId: "site-a",
    organizationRole: null,
    siteRole: "EDITOR",
    tokenHash: "hashed:raw-token",
    expiresAt: new Date(Date.now() + 60_000),
    acceptedAt: null,
  };
  const databaseService = {
    client: {
      $transaction(callback) {
        return callback({
          invitation: {
            findUnique() {
              return invitation;
            },
            update({ data }) {
              invitationUpdate = data;

              return invitation;
            },
          },
          siteMembership: {
            upsert(data) {
              upsertData = data;

              return { id: "membership-a" };
            },
          },
          organizationMembership: {
            upsert() {
              throw new Error("Organization membership should not be used.");
            },
          },
        });
      },
    },
  };
  const cryptoService = {
    hashToken(token) {
      return `hashed:${token}`;
    },
  };
  const service = new InvitationsService(databaseService, {}, cryptoService);

  const result = await service.accept(
    {
      id: "user-a",
      email: "editor@example.com",
      name: "Editor",
    },
    "raw-token",
  );

  assert.equal(upsertData.create.siteId, "site-a");
  assert.equal(upsertData.create.userId, "user-a");
  assert.equal(upsertData.create.role, "EDITOR");
  assert.ok(invitationUpdate.acceptedAt instanceof Date);
  assert.deepEqual(result, { success: true });
});

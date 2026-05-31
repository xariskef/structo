import assert from "node:assert/strict";
import { test } from "node:test";

import { AuthService } from "../dist/modules/auth/auth.service.js";

test("owner registration creates an organization owner membership and a session", async () => {
  let organizationData;
  let sessionData;

  const databaseService = {
    client: {
      $transaction(callback) {
        return callback({
          user: {
            create({ data }) {
              assert.equal(data.passwordCredential.create.passwordHash, "hash");

              return {
                id: "user-a",
                email: data.email,
                name: data.name,
              };
            },
          },
          organization: {
            create({ data }) {
              organizationData = data;

              return { id: "organization-a" };
            },
          },
        });
      },
      authSession: {
        create({ data }) {
          sessionData = data;

          return { id: "session-a" };
        },
      },
    },
  };
  const cryptoService = {
    hashPassword() {
      return "hash";
    },
    createToken() {
      return "raw-token";
    },
    hashToken(token) {
      return `hashed:${token}`;
    },
  };
  const service = new AuthService(databaseService, cryptoService);

  const result = await service.registerOwner({
    email: "owner@example.com",
    password: "long-password",
    name: "Owner",
    organizationName: "Example",
    organizationSlug: "example",
  });

  assert.equal(organizationData.memberships.create.role, "OWNER");
  assert.equal(organizationData.memberships.create.userId, "user-a");
  assert.equal(sessionData.userId, "user-a");
  assert.equal(sessionData.tokenHash, "hashed:raw-token");
  assert.equal(result.token, "raw-token");
});

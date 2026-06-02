import type { OpenAPIObject } from "@nestjs/swagger";
import {
  deliveryContentTypeSchema,
  deliveryEntrySchema,
  deliveryListSchema,
  deliveryMenuSchema,
  deliverySiteSchema,
} from "@structo/contracts";
import { z } from "zod";

function response(schema: object, description = "Successful response") {
  return {
    "200": {
      description,
      content: { "application/json": { schema } },
    },
    "401": { description: "Missing or invalid delivery token" },
    "404": { description: "Site or resource not found" },
  };
}

function ref(name: string) {
  return { $ref: `#/components/schemas/${name}` };
}

export function getDeliveryOpenApiDocument(): OpenAPIObject {
  return {
    openapi: "3.1.0",
    info: {
      title: "Structo CMS Delivery API",
      version: "1.0.0",
      description: "Published, read-only site content for external frontends.",
    },
    servers: [{ url: "/api/v1/delivery" }],
    security: [{ bearerAuth: [] }],
    paths: {
      "/sites/{siteKey}/settings": {
        get: {
          summary: "Get site settings",
          parameters: [siteKeyParameter],
          responses: response(ref("DeliverySite")),
        },
      },
      "/sites/{siteKey}/content-types": {
        get: {
          summary: "List active content types",
          parameters: [siteKeyParameter],
          responses: response({
            type: "array",
            items: ref("DeliveryContentType"),
          }),
        },
      },
      "/sites/{siteKey}/content-types/{typeSlug}": {
        get: {
          summary: "Get an active content type",
          parameters: [siteKeyParameter, typeSlugParameter],
          responses: response(ref("DeliveryContentType")),
        },
      },
      "/sites/{siteKey}/content-types/{typeSlug}/entries": {
        get: {
          summary: "List published entries",
          parameters: [
            siteKeyParameter,
            typeSlugParameter,
            queryParameter("page", "integer"),
            queryParameter("pageSize", "integer"),
            queryParameter("sort", "string"),
            queryParameter("category", "string"),
            queryParameter("tag", "string"),
          ],
          responses: response(ref("DeliveryEntryList")),
        },
      },
      "/sites/{siteKey}/content-types/{typeSlug}/entries/{entrySlug}": {
        get: {
          summary: "Get a published entry",
          parameters: [siteKeyParameter, typeSlugParameter, entrySlugParameter],
          responses: response(ref("DeliveryEntry")),
        },
      },
      "/sites/{siteKey}/navigation-menus": {
        get: {
          summary: "List navigation menus",
          parameters: [siteKeyParameter],
          responses: response({ type: "array", items: ref("DeliveryMenu") }),
        },
      },
      "/sites/{siteKey}/navigation-menus/{menuKey}": {
        get: {
          summary: "Get a navigation menu",
          parameters: [siteKeyParameter, menuKeyParameter],
          responses: response(ref("DeliveryMenu")),
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "Site API token",
        },
      },
      schemas: {
        DeliverySite: z.toJSONSchema(deliverySiteSchema),
        DeliveryContentType: z.toJSONSchema(deliveryContentTypeSchema),
        DeliveryEntry: z.toJSONSchema(deliveryEntrySchema),
        DeliveryEntryList: z.toJSONSchema(
          deliveryListSchema(deliveryEntrySchema),
        ),
        DeliveryMenu: z.toJSONSchema(deliveryMenuSchema),
      },
    },
  } as unknown as OpenAPIObject;
}

const siteKeyParameter = pathParameter("siteKey");
const typeSlugParameter = pathParameter("typeSlug");
const entrySlugParameter = pathParameter("entrySlug");
const menuKeyParameter = pathParameter("menuKey");

function pathParameter(name: string) {
  return { name, in: "path", required: true, schema: { type: "string" } };
}

function queryParameter(name: string, type: "integer" | "string") {
  return { name, in: "query", required: false, schema: { type } };
}

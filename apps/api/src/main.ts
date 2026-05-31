import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";

import { AppModule } from "./app.module.js";

const DEFAULT_API_PORT = 3001;

config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
});

function resolvePort(value: string | undefined): number {
  if (!value) {
    return DEFAULT_API_PORT;
  }

  const port = Number.parseInt(value, 10);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("API_PORT must be a positive integer.");
  }

  return port;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: process.env.ADMIN_APP_URL ?? "http://localhost:3000",
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Structo CMS API")
    .setDescription("Management, delivery and platform API surfaces.")
    .setVersion("1.0")
    .build();

  SwaggerModule.setup("api/docs", app, () =>
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  await app.listen(resolvePort(process.env.API_PORT));
}

void bootstrap();

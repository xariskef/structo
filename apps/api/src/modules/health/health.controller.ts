import { Controller, Get } from "@nestjs/common";
import type { HealthResponse } from "@structo/contracts";

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      service: "structo-api",
      status: "ok",
    };
  }
}

import { Controller, Get } from "@nestjs/common";
import type { HealthResponse } from "@structo/contracts";

import { Public } from "../auth/public.decorator.js";

@Controller("health")
export class HealthController {
  @Public()
  @Get()
  getHealth(): HealthResponse {
    return {
      service: "structo-api",
      status: "ok",
    };
  }
}

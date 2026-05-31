export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: ApiErrorDetail[];
  };
}

export interface HealthResponse {
  service: "structo-api";
  status: "ok";
}

export * from "./auth.js";
export * from "./tenancy.js";
export * from "./settings.js";
export * from "./content-types.js";
export * from "./entries.js";

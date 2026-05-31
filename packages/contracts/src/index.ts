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

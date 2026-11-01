// ApiError 封装 — 移植自 lab-management-system-react/src/api/http-client.ts（REQ-2026-031）。
// 差异：axios → Angular HttpClient；toApiError 吃 HttpErrorResponse（响应体在 .error）。
import { HttpErrorResponse } from "@angular/common/http";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `API ${status}`);
    this.status = status;
    this.body = body;
  }
}

/** 从 HttpClient 错误构造 ApiError（响应体里的 ErrorResponse 直接透传） */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof HttpErrorResponse) {
    return new ApiError(err.status, err.error ?? null, err.message);
  }
  if (err instanceof Error) return new ApiError(0, null, err.message);
  return new ApiError(0, null, String(err));
}

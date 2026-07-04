/**
 * 统一 API 响应格式工具
 */

/** 成功的 JSON 响应体 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

/** 失败的 JSON 响应体 */
export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function apiSuccess<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

export function apiError(message: string, code?: string): ApiError {
  return { success: false, error: message, ...(code ? { code } : {}) };
}

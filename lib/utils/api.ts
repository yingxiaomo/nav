/**
 * 统一后端 API 请求封装。
 *
 * 设计约束（对应项目"前端可脱离后端独立运行"的定位）：
 * - baseUrl 可空：为空时走同源相对路径（Docker 全合一模式 /api/v1/...）
 * - 失败静默：静态部署（无后端）时请求必然失败，调用方不能因此崩溃——
 *   所有函数失败返回 null/undefined 或抛出的错误由调用方 try/catch 吸收。
 * - 不改变调用时机：仅在被组件主动调用时才发起请求，模块加载期零副作用，
 *   SSR/静态导出阶段绝不触发。
 * - 保持 ES 模块惰性：本文件不 import React，可在任意 client 组件中使用。
 */

export interface ApiRequestOptions {
  /** 请求体（JSON 对象）。传 FormData 时自动用 FormData 发送且不设 Content-Type */
  body?: unknown;
  /** 额外请求头（如 Authorization: Bearer xxx） */
  headers?: Record<string, string>;
  /** 覆盖默认 method（默认 GET） */
  method?: string;
  /** 响应解析方式（默认 json）；日志等纯文本接口用 text */
  responseType?: "json" | "text";
}

export interface ApiOk<T> {
  ok: true;
  status: number;
  data: T;
}

export interface ApiFail<T = unknown> {
  ok: false;
  status: number;
  /** 失败响应体（后端错误信息或空对象）；网络异常时为 undefined */
  data?: T;
}

export type ApiResult<T> = ApiOk<T> | ApiFail<T>;

/** 拼接 baseUrl + 路径，兼容 baseUrl 为空、末尾带斜杠、路径首部带/等情况 */
export function joinApiUrl(baseUrl: string | null | undefined, path: string): string {
  const base = (baseUrl || "").replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/** 基础请求：组装 headers/JSON/FormData，返回带解析数据的 ApiResult（失败静默） */
export async function request<T = unknown>(
  baseUrl: string | null | undefined,
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResult<T>> {
  const { body, headers = {}, method, responseType = "json" } = options;
  const finalHeaders: Record<string, string> = { ...headers };
  let finalBody: BodyInit | undefined;

  if (body instanceof FormData) {
    finalBody = body;
  } else if (body !== undefined) {
    finalHeaders["Content-Type"] ??= "application/json";
    finalBody = JSON.stringify(body);
  }

  try {
    const res = await fetch(joinApiUrl(baseUrl, path), {
      method: method ?? (body !== undefined ? "POST" : "GET"),
      headers: finalHeaders,
      body: finalBody,
    });
    const data = (responseType === "text"
      ? await res.text()
      : await res.json().catch(() => ({}))) as T;
    if (!res.ok) return { ok: false, status: res.status, data };
    return { ok: true, status: res.status, data };
  } catch {
    // 网络异常 / 静态部署无后端：静默失败，调用方按 null 处理
    return { ok: false, status: 0 };
  }
}

/** GET 请求（返回 data 或 null） */
export async function apiGet<T = unknown>(
  baseUrl: string | null | undefined,
  path: string,
  headers?: Record<string, string>,
): Promise<T | null> {
  const res = await request<T>(baseUrl, path, { method: "GET", headers });
  return res.ok ? res.data : null;
}

/** POST/PUT/DELETE 等写请求（失败返回 false） */
export async function apiWrite(
  baseUrl: string | null | undefined,
  path: string,
  options: ApiRequestOptions = {},
): Promise<boolean> {
  const { ok } = await request<unknown>(baseUrl, path, options);
  return ok;
}
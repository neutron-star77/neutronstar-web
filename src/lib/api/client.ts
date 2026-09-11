/**
 * 统一取数客户端。
 *
 * base 优先级：构建期环境变量 PUBLIC_API_BASE > 真实后端（兜底）。
 * 目标态：前端走中间层 `/api`（同源 CF Worker），由中间层负责缓存/聚合/CORS；
 * 过渡态（中间层未上线）：直连真实后端 kirameku-api.neutronstar.fun（已配 CORS）。
 * 路径统一以 `/api` 或 `/bff` 开头。
 */

const API_BASE =
  import.meta.env.PUBLIC_API_BASE ?? "https://bff.neutronstar.fun";

export const API_BASE_URL = API_BASE;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** GitHub OAuth 登录态在 localStorage 里的键（P5） */
export const AUTH_TOKEN_KEY = "kirameku_github_token";

/**
 * 登录态请求头（浏览器侧）。
 * SSR/预渲染环境下没有 localStorage，直接返回空对象。
 */
export function authHeaders(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return res.statusText;
  }
}

/** 兼容 { code, data } 包裹与裸数组/对象两种后端响应 */
function unwrap<T>(data: unknown): T {
  if (data && typeof data === "object" && !Array.isArray(data) && "data" in data) {
    return (data as { data: T }).data;
  }
  return data as T;
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...authHeaders(), ...init?.headers },
  });

  if (!res.ok) {
    throw new ApiError(res.status, await safeText(res));
  }
  return unwrap<T>(await res.json());
}

/** 写操作（P5：点赞/评论等），带登录态；经 BFF 透传不缓存 */
export async function apiPost<T>(path: string, body?: unknown): Promise<T | null> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...authHeaders(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    throw new ApiError(res.status, await safeText(res));
  }
  const text = await res.text();
  if (!text) return null;
  try {
    return unwrap<T>(JSON.parse(text));
  } catch {
    return null;
  }
}

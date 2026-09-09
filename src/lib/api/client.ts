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

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return res.statusText;
  }
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  });

  if (!res.ok) {
    throw new ApiError(res.status, await safeText(res));
  }

  const data = await res.json();
  // 兼容 { code, data } 包裹与裸数组/对象两种后端响应
  if (data && typeof data === "object" && !Array.isArray(data) && "data" in data) {
    return data.data as T;
  }
  return data as T;
}

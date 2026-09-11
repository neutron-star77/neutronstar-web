/**
 * 登录态（P5：GitHub OAuth）。
 *
 * 流程：前端 → `${API_BASE_URL}/api/auth/github/login`（BFF 透传到 NAS 后端）
 * → GitHub 授权页 → 回调 `/api/auth/github/callback` → 后端换 token 签 JWT
 * → 302 回 `${FRONTEND_ORIGIN}/auth/callback?token=…` → 本地落地页把 token 存 localStorage
 * → 之后所有请求带 `Authorization: Bearer <token>`（见 `api/client.ts` 的 authHeaders）。
 *
 * 注意：token 存 localStorage 有 XSS 风险，属当前取舍（后端是 302 带 query 的形态）；
 * 后续要升级成 httpOnly cookie 需后端配合改回调方式。
 */

import { useEffect, useState } from "react";
import useSWR from "swr";
import { API_BASE_URL, AUTH_TOKEN_KEY, apiGet } from "./api/client";

export interface GithubUser {
  id: number;
  login: string;
  avatar: string;
  bio: string;
}

export function getToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    // 隐私模式下写不了，忽略：表现为刷新后需要重新登录
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    /* noop */
  }
}

/** 发起登录：整页跳到后端 /login（后端会 302 到 GitHub 授权页） */
export function loginUrl(): string {
  return `${API_BASE_URL}/api/auth/github/login`;
}

/**
 * 当前登录用户。未登录（无 token）时不发请求。
 * 后端 `/api/auth/github/me` 需要 `Authorization: Bearer`。
 */
export function useGithubUser() {
  const [token, setTokenState] = useState<string | null>(null);

  useEffect(() => {
    setTokenState(getToken());
  }, []);

  const { data, isLoading, mutate } = useSWR<GithubUser>(
    token ? ["github-me", token] : null,
    () => apiGet<GithubUser>("/api/auth/github/me"),
    { shouldRetryOnError: false, revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  return {
    user: data ?? null,
    /** 首次挂载时先读一遍 localStorage，这期间不发请求 */
    isLoading: Boolean(token) && isLoading,
    token,
    logout: () => {
      clearToken();
      setTokenState(null);
      void mutate(undefined, { revalidate: false });
    },
  };
}

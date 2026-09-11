/**
 * AuthButton —— GitHub 登录态入口（React island）。
 *
 * 未登录：一个「用 GitHub 登录」按钮 → 跳后端 `/api/auth/github/login`。
 * 已登录：头像 + 用户名 + 退出（清 localStorage）。
 *
 * 挂在需要登录态的页面（说说/相册；P5 评论区也会复用）。
 */

import { loginUrl, useGithubUser } from "../../lib/auth";

interface Props {
  className?: string;
}

export default function AuthButton({ className = "" }: Props) {
  const { user, isLoading, token, logout } = useGithubUser();

  if (isLoading) {
    return <span className={`text-xs text-on-surface-variant ${className}`}>登录态检查中…</span>;
  }

  if (user) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {user.avatar && (
          <img
            src={user.avatar}
            alt={user.login}
            width="24"
            height="24"
            loading="lazy"
            className="h-6 w-6 rounded-full"
          />
        )}
        <span className="text-xs text-on-surface-variant">@{user.login}</span>
        <button
          type="button"
          onClick={logout}
          className="text-xs text-on-surface-variant underline underline-offset-2 transition-colors hover:text-primary"
        >
          退出
        </button>
      </div>
    );
  }

  // token 存在但 /me 拿不到（过期/后端未配 OAuth）时也走这里，给用户一个重新登录的入口
  return (
    <a
      href={loginUrl()}
      className={`inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-4 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-high ${className}`}
      title={token ? "登录态已失效，点此重新登录" : "用 GitHub 账号登录后可评论/点赞"}
    >
      用 GitHub 登录
    </a>
  );
}

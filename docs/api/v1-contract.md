# BFF API v1 合同

状态：阶段 1 草案，供 BFF 和页面实现共同评审。

## 统一响应

所有接口都返回：

```json
{
  "data": {},
  "error": null,
  "meta": { "request_id": "req_01", "cached": true }
}
```

成功时 `error` 为 `null`。失败时 `data` 为 `null`，`error` 至少包含 `code`、`message`、`request_id`。分页列表在 `meta` 返回 `page`、`size`、`total`、`has_more`。

浏览器只访问 `/api/v1/*`。BFF 负责认证、CORS、上游超时、缓存、限流和媒体签名；浏览器不直接访问 Supabase、NAS 或 R2 私有凭证。

## 资源和接口

| 方法 | 路径 | 响应 `data` | 认证 | 缓存/写入约束 |
|---|---|---|---|---|
| GET | `/api/v1/profile` | `Profile` | 公开 | `public, max-age=60, s-maxage=300` |
| GET | `/api/v1/posts/:slug` | `Post` | 公开 | `public, s-maxage=60`; 未发布内容不返回 |
| GET | `/api/v1/albums` | `Album[]` | 公开 | `public, s-maxage=60` |
| GET | `/api/v1/albums/:id/photos` | `AlbumPhoto[]` | 公开 | `public, s-maxage=60` |
| GET | `/api/v1/books` | `Book[]` | 公开 | `public, s-maxage=60` |
| GET | `/api/v1/books/:id` | `Book` | 公开 | `public, s-maxage=60` |
| GET | `/api/v1/moments` | `Moment[]` | 公开 | `public, s-maxage=30` |
| GET | `/api/v1/comments?target_type=&target_id=` | `Comment[]` | 公开 | `public, s-maxage=15` |
| POST | `/api/v1/comments` | `Comment` | 登录 | `no-store`; 要求 `Idempotency-Key` |
| POST | `/api/v1/likes/toggle` | `LikeResult` | 登录 | `no-store`; 要求 `Idempotency-Key` |
| GET | `/api/v1/reading-progress/:book_id` | `ReadingProgress \| null` | 登录 | `private, no-store` |
| PUT | `/api/v1/reading-progress/:book_id` | `ReadingProgress` | 登录 | `private, no-store`; 要求 `Idempotency-Key` |
| GET | `/api/v1/playlist` | `PlaylistItem[]` | 公开 | `public, s-maxage=30` |
| PUT | `/api/v1/playlist` | `PlaylistItem[]` | 管理员 | `no-store`; 要求 `Idempotency-Key` |
| GET | `/api/v1/media/:id/url` | `MediaUrl` | 公开或登录，按资源权限 | `private/no-store`，签名 URL 不能公共缓存 |
| GET | `/api/v1/health` | `HealthStatus` | 公开 | `no-store`；必须区分 BFF、数据库、媒体状态 |

列表接口统一接受 `page`、`size`，默认 `page=1,size=20`，服务端最大 `size=100`。非法分页返回 `400 bad_request`。

## 请求体

```json
// POST /api/v1/comments
{ "target_type": "post", "target_id": "post_123", "body": "内容" }

// POST /api/v1/likes/toggle
{ "target_type": "post", "target_id": "post_123" }

// PUT /api/v1/reading-progress/:book_id
{ "locator": "epubcfi(/6/4[chapter01]!/4/2)", "progress": 0.42 }

// PUT /api/v1/playlist
{ "items": [{ "media_id": "media_song_1", "sort": 1 }] }
```

## 错误码与 HTTP 状态

| HTTP | `error.code` | 使用场景 |
|---:|---|---|
| 400 | `bad_request` | 参数、分页或请求体不合法 |
| 401 | `unauthorized` | 缺少或失效登录凭证 |
| 403 | `forbidden` | 已登录但没有资源权限 |
| 404 | `not_found` | slug、资源或媒体不存在 |
| 409 | `conflict` | 幂等键重复但请求体不同、版本冲突 |
| 429 | `rate_limited` | 超过 BFF 或写接口限流 |
| 502/503 | `upstream_unavailable` | 数据库、NAS 或媒体上游不可用 |
| 500 | `internal_error` | 未分类服务错误；不得泄漏 SQL、密钥或内部路径 |

## ID 与安全规则

- 对外 ID 使用稳定字符串（例如 `post_123`、`album_42`、`media_9`），不得暴露 Supabase 内部表名或 NAS 路径。
- slug 只用于可读 URL，不能作为动态写接口的唯一授权依据。
- 所有写接口要求登录、CSRF/CORS 校验、请求体大小限制和 `Idempotency-Key`。
- `target_type`、`target_id` 必须由 BFF 做资源存在性和可评论性校验。
- 文章、相册、图书等公开 GET 可以缓存；评论、点赞、阅读进度和播放列表写入禁止公共缓存。

## 当前迁移映射

旧 `/api/posts`、`/api/albums` 等接口仍由现有页面使用，阶段 1 不切换运行时。后续 BFF adapter 可按以下方式映射：

- `/api/posts` -> `/api/v1/posts/:slug` 与列表接口
- `/api/albums`、`/api/albums/:id/photos` -> 同名 v1 资源
- `/api/chatters` -> `/api/v1/moments`
- `/api/likes/toggle` -> `/api/v1/likes/toggle`
- `/api/messages` -> 后续决定是否归入 `content-item` 或单独资源

## 健康检查示例

```json
{
  "data": {
    "status": "degraded",
    "bff": "ok",
    "database": "ok",
    "media": "degraded",
    "checked_at": "2026-10-22T12:00:00Z"
  },
  "error": null,
  "meta": { "request_id": "req_01", "cached": false }
}
```

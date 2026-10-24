/**
 * Versioned BFF contract for the combined blog architecture.
 * Runtime adapters may map the current legacy API into these shapes during the
 * migration; page code should not depend on database or storage fields.
 */

export type ISODate = string;

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "upstream_unavailable"
  | "internal_error";

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  request_id: string;
  details?: Record<string, unknown>;
}

export interface ApiMeta {
  request_id: string;
  page?: number;
  size?: number;
  total?: number;
  has_more?: boolean;
  cached?: boolean;
}

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
  meta: ApiMeta;
}

export interface PageQuery {
  page?: number;
  size?: number;
}

export interface ContentItem {
  id: string;
  kind: "post" | "book" | "project" | "album";
  slug: string;
  title: string;
  description: string;
  body?: string;
  cover_media_id?: string | null;
  tags: string[];
  published_at: ISODate | null;
  updated_at: ISODate | null;
}

export interface Post extends ContentItem {
  kind: "post";
  category: string | null;
  reading_time: number;
  views: number;
  likes: number;
}

export interface Album {
  id: string;
  title: string;
  description: string;
  cover_media_id: string | null;
  photo_count: number;
  created_at: ISODate;
  updated_at: ISODate | null;
}

export interface AlbumPhoto {
  id: string;
  album_id: string;
  media_id: string;
  caption: string;
  width: number | null;
  height: number | null;
  taken_at: ISODate | null;
  sort: number;
}

export interface Book {
  id: string;
  slug: string;
  title: string;
  author: string | null;
  description: string;
  cover_media_id: string | null;
  file_id: string | null;
  reading_enabled: boolean;
  published_at: ISODate | null;
  updated_at: ISODate | null;
}

export interface BookFile {
  id: string;
  book_id: string;
  format: "epub" | "pdf" | "other";
  size_bytes: number;
  checksum: string | null;
  downloadable: boolean;
}

export interface ReadingProgress {
  book_id: string;
  locator: string;
  progress: number;
  updated_at: ISODate;
}

export interface Moment {
  id: string;
  content: string;
  media_ids: string[];
  likes: number;
  comments_count: number;
  published_at: ISODate;
}

export type CommentTargetType = "post" | "book" | "album" | "moment";

export interface Comment {
  id: string;
  target_type: CommentTargetType;
  target_id: string;
  author: { id: string; name: string; avatar_media_id: string | null };
  body: string;
  created_at: ISODate;
  updated_at: ISODate | null;
}

export interface LikeResult {
  target_type: CommentTargetType;
  target_id: string;
  liked: boolean;
  count: number;
}

export interface PlaylistItem {
  id: string;
  media_id: string;
  title: string;
  artist: string | null;
  sort: number;
}

export interface MediaAsset {
  id: string;
  kind: "image" | "audio" | "video" | "model" | "epub" | "other";
  mime_type: string;
  width?: number | null;
  height?: number | null;
  duration_ms?: number | null;
  size_bytes: number | null;
}

export interface MediaUrl {
  media_id: string;
  url: string;
  expires_at: ISODate | null;
}

export interface Profile {
  name: string;
  tagline: string;
  avatar_media_id: string | null;
  navigation: Array<{ label: string; href: string }>;
}

export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  bff: "ok" | "degraded";
  database: "ok" | "degraded" | "down";
  media: "ok" | "degraded" | "down";
  checked_at: ISODate;
}

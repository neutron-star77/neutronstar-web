/** 后端真实字段契约（与 kirameku-api 对齐，见 T0/T1 探查样本） */

export interface PostSummary {
  id: number;
  title: string;
  slug: string;
  description: string;
  cover: string;
  category: string;
  tags: string[];
  status: string;
  is_pinned: boolean;
  views: number;
  likes: number;
  word_count: number;
  reading_time: number;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export interface Post extends PostSummary {
  content: string;
}

export interface Chatter {
  id: number;
  content: string;
  images: string[];
  mood: string;
  likes: number;
  comments_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Album {
  id: number;
  title: string;
  description: string;
  cover: string;
  photo_count: number;
  sort: number;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: number;
  album_id: number;
  url: string;
  caption: string;
  orientation: "landscape" | "portrait";
  sort: number;
  created_at: string;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
  post_count: number;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
}

/** 列表接口返回裸数组（后端无 total 头）；前端用返回长度 == size 判断 hasMore */
export type ListResult<T> = T[];

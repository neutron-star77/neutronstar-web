/**
 * 液态玻璃纹理上传协调模块
 *
 * adapted from github.com/haloo-cod/Nebula (MIT)
 *
 * 在新架构中,纹理由共享渲染器统一管理,此模块仅保留
 * waitForNextTextureUploadSettled / waitForTextureUploadQueueIdle 接口,
 * 供需要"等纹理就绪再切换 UI"的场景使用。
 *
 * 与 Nebula 原版差异：原版盯住 UI store 的明/暗两套背景 URL;
 * 本站背景纹理由调用方（islands/LiquidGlass.tsx）按需上传,
 * 因此协调函数改为可注入的 URL 列表,缺省立即 resolve。
 */

import { hasTexture, waitForTexture } from './liquidGlassRenderer'

/** 等待列出的纹理全部就绪（超时兜底,不阻塞 UI） */
export function waitForTexturesReady(urls: string[], timeoutMs = 1200): Promise<void> {
  return Promise.race([
    Promise.all(
      urls
        .filter((url) => url && !hasTexture(url))
        .map((url) => waitForTexture(url, timeoutMs)),
    ).then(() => {}),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ])
}

/** 等待纹理上传队列空闲（在新架构中纹理上传是同步的,直接 resolve） */
export function waitForTextureUploadQueueIdle(): Promise<void> {
  return Promise.resolve()
}

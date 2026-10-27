#!/bin/sh
# 520 内网镜像一键同步：构建（直连 v2-api）→ 图片本地化 → 打包分片 → nas_push → 远端校验换装。
# 用法：cd web && sh scripts/sync-intranet-520.sh
# 依赖：ssh hewll 免密（~/.ssh/config）、nas_push.ps1 门禁通道、node/pnpm。
# 说明：公网重建由后台发文链路自动触发（v2_sync workflow_dispatch）；
#       内网 520 是 LAN 内静态快照，服务端触达不到，发文后手动跑本脚本一次。
set -eu

cd "$(dirname "$0")/.."
echo "== [1/5] 清模块缓存 + 内网直连构建（坑 6.7.7：不清缓存产物可能是旧的）=="
rm -rf node_modules/.vite node_modules/.astro .astro
PUBLIC_API_BASE=http://192.168.5.4:8200 pnpm build

echo "== [2/5] 图片本地化 =="
node scripts/localize-intranet-images.mjs

TMP=/f/AI/agents/ZCODE/date/run/sync-520-$(date +%H%M%S)
mkdir -p "$TMP"
echo "== [3/5] 打包 + 分片（nas_push 单连接 payload ~57MB 必断，坑 6.4.13）=="
(cd dist/client && tar czf "$TMP/dist-520.tar.gz" .)
MD5=$(md5sum "$TMP/dist-520.tar.gz" | cut -d' ' -f1)
echo "本地 md5: $MD5"
(cd "$TMP" && split -b 20m -d dist-520.tar.gz dist-520.part.)
ls -la "$TMP"/dist-520.part.* | awk '{print $9, $5}'

echo "== [4/5] 逐片 nas_push（每片必须单独一次调用，多文件会拼同一 payload）=="
for part in "$TMP"/dist-520.part.*; do
    echo "--- 推送 $(basename "$part") ---"
    powershell -NoProfile -Command "& 'F:\AI\AI skill\nas-deploy\scripts\nas_push.ps1' -Path '$(cygpath -w "$part")' -RemoteDir '/share/CACHEDEV1_DATA/Web/blog'" || {
        echo "!! 分片推送失败：$part"; exit 1; }
done

echo "== [5/5] 远端：拼接 → md5 校验 → 备份旧站 → 换装 =="
ssh hewll "set -e
cd /share/CACHEDEV1_DATA/Web/blog
cat dist-520.part.* > dist-520.tar.gz && rm -f dist-520.part.*
GOT=\$(md5sum dist-520.tar.gz | cut -d' ' -f1)
echo \"远端 md5: \$GOT\"
if [ \"\$GOT\" != '$MD5' ]; then echo '!! md5 不一致，中止（旧站未动）'; exit 1; fi
cd /share/CACHEDEV1_DATA/Web
tar czf blog-backup-\$(date +%Y%m%d-%H%M%S).tar.gz blog
cd blog
find . -mindepth 1 -maxdepth 1 -not -name 'dist-520.tar.gz' -exec rm -rf {} +
tar xzf dist-520.tar.gz && rm dist-520.tar.gz
echo '远端顶层：' && ls | head -8"

rm -rf "$TMP"
echo "== 完成：http://192.168.5.4:520 已更新 =="

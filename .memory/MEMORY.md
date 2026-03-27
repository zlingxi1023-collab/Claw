# Claw 项目长期记忆

## 项目信息
- **项目**: Six Little Ducks 合唱表演应用（6人合唱互动播放器）
- **仓库**: `github.com/zlingxi1023-collab/Claw` (main 分支)
- **技术**: 纯静态 HTML/CSS/JS，HLS 视频流 + MP4 fallback

## 部署
- **Cloudflare Pages**: `https://claw-abx.pages.dev` (项目名: claw)
  - wrangler CLI 已 OAuth 登录，可用 `npx wrangler pages deploy` 更新
  - 单文件限制 25MB，视频已压缩适配
- **GitHub Pages**: `https://zlingxi1023-collab.github.io/Claw/` (iPad/国内 SSL 受限，已改用 CF Pages)

## 媒体文件
- MP4 视频已压缩至 <25MB (CRF 28, H.264 Main profile)
- HLS 使用独立分片模式 (seg000.ts ~ segNNN.ts)，非 byte-range 模式
- hls-loader.js 版本: v8

---
*最后更新: 2026-03-27*

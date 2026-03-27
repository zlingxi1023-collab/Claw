---
name: cloudflare-pages-deploy
overview: 将 Claw 项目部署到 Cloudflare Pages，解决 GitHub Pages 在国内 SSL 受限的问题。需要处理大视频文件超过 25MB 单文件限制的问题。
todos:
  - id: compress-videos
    content: 用 ffmpeg 压缩两个超限 MP4 视频到 25MB 以内（CRF 28），并重新生成独立分片模式的 HLS 切片文件替换原有 byte-range 模式
    status: completed
  - id: update-hls-loader
    content: 更新 hls-loader.js：移除 HLS_SOURCES 中 ts 字段，更新版本注释为 v8
    status: completed
    dependencies:
      - compress-videos
  - id: deploy-cloudflare
    content: 使用 npx wrangler pages deploy 将项目部署到 Cloudflare Pages，获取 pages.dev 访问地址
    status: completed
    dependencies:
      - update-hls-loader
  - id: push-github
    content: 使用 [mcp:github] 将压缩后的代码和媒体文件推送到 GitHub 仓库保持同步
    status: completed
    dependencies:
      - update-hls-loader
  - id: verify-deploy
    content: 验证 Cloudflare Pages 部署结果，确认页面可正常访问并输出最终地址
    status: completed
    dependencies:
      - deploy-cloudflare
---

## 用户需求

用户的 GitHub Pages 站点在 iPad/国内网络环境下出现 SSL 受限（ERR_SSL_PROTOCOL_ERROR），无法访问。用户已注册 Cloudflare 账号，要求将项目部署到 Cloudflare Pages 作为替代方案，除注册外其余操作由 AI 完成。

## 产品概述

将 Six Little Ducks 合唱表演应用从 GitHub Pages 迁移部署到 Cloudflare Pages，确保国内 iPad/iPhone 设备可稳定访问。

## 核心功能

- 将现有全部静态资源（HTML/CSS/JS/媒体文件）部署到 Cloudflare Pages
- 确保所有文件符合 Cloudflare Pages 单文件 25MB 限制
- 压缩超限的 MP4 视频文件，重新生成符合大小限制的 HLS 切片
- 通过 wrangler CLI 一键完成部署，获取可访问的 pages.dev 地址
- 保持所有功能（播放、歌词同步、重复播放、滚动跳转）正常工作

## 技术栈

- 部署平台：Cloudflare Pages（免费，国内访问较稳定）
- 部署工具：npx wrangler（版本 4.77.0，已可用）
- 视频处理：ffmpeg（压缩 MP4 到 25MB 以内，重新生成 HLS 独立分片）
- 现有代码：纯静态 HTML/CSS/JS 项目，无构建步骤

## 实现方案

### 核心问题：Cloudflare Pages 单文件 25MB 限制

当前超限文件：

| 文件 | 大小 | 状态 |
| --- | --- | --- |
| `media/six-little-ducks-video.mp4` | 30MB | 超限 |
| `media/six-little-ducks-video-muted.mp4` | 29MB | 超限 |
| `media/hls/video/seg.ts` | ~84MB | 超限 |
| `media/hls/video-muted/seg.ts` | ~82MB | 超限 |
| `Six_Little_Ducks.mp4` | 16MB | OK |
| `media/six-little-ducks-instrumental-extracted.mp3` | 2.2MB | OK |
| `media/hls/audio/seg.ts` | ~1.7MB | OK |


### 解决策略

**第一步：压缩 MP4 视频到 25MB 以内**

使用 ffmpeg 降低码率，将两个 MP4 从 ~30MB 压缩到 ~24MB：

- 视频时长约 93 秒（47 个 2 秒切片）
- 目标码率：24MB / 93s = ~2000kbps（当前约 2600kbps）
- 使用 H.264 CRF 模式（CRF 28），保持视觉质量同时控制文件大小
- 保持分辨率不变，仅降低码率

**第二步：重新生成 HLS 切片（独立分片模式）**

当前 HLS 使用 byte-range 模式（单个大 seg.ts），改为独立分片模式（多个小 .ts 文件，每个 2 秒约 500KB-3MB），每个文件远小于 25MB 限制。

**第三步：更新 hls-loader.js 配置**

HLS 从 byte-range 模式改为独立分片模式后，m3u8 文件格式变化，但 hls.js 和 Safari 原生 HLS 都能自动处理，无需修改播放器逻辑。仅需移除代码中对单个 `seg.ts` 文件的引用（`ts` 字段）。

**第四步：wrangler CLI 部署**

使用 `npx wrangler pages deploy . --project-name=claw` 一键部署。

### 关于 `Six_Little_Ducks.mp4`（16MB）

该文件在项目根目录但代码中未被引用（HLS_SOURCES 不包含它），是原始素材文件。为减少部署体积，应排除此文件。如果确实需要保留，它本身不超限（16MB）。

## 实现注意事项

- ffmpeg 压缩后需验证 iOS Safari 播放兼容性（H.264 Baseline/Main profile）
- HLS 独立分片模式兼容性更好，不依赖 byte-range 支持
- wrangler 首次部署需要在终端中进行 OAuth 登录（会弹浏览器窗口）
- Cloudflare Pages 免费版限制：单文件 25MB、总仓库大小 25MB（但直接上传方式无总大小限制，通过 wrangler pages deploy 上传）
- 部署后地址格式为 `https://claw.pages.dev` 或 `https://<hash>.claw.pages.dev`

## 架构设计

部署后的文件结构变化（仅媒体目录）：

```
media/
  hls/
    video/
      index.m3u8           # [MODIFY] 重新生成，独立分片模式
      seg000.ts            # [NEW] 独立切片文件 x N
      seg001.ts
      ...
    video-muted/
      index.m3u8           # [MODIFY] 重新生成，独立分片模式
      seg000.ts            # [NEW]
      ...
    audio/
      index.m3u8           # 不变（音频已小于 25MB）
      seg.ts               # 不变（1.7MB）
  six-little-ducks-video.mp4         # [MODIFY] 压缩后 <25MB
  six-little-ducks-video-muted.mp4   # [MODIFY] 压缩后 <25MB
  six-little-ducks-instrumental-extracted.mp3  # 不变
```

## 目录结构

```
project-root/
├── js/
│   └── hls-loader.js      # [MODIFY] 移除 HLS_SOURCES 中的 ts 字段引用（byte-range 单文件不再使用）
├── media/
│   ├── hls/
│   │   ├── video/
│   │   │   ├── index.m3u8       # [MODIFY] 重新生成为独立分片格式
│   │   │   ├── seg000.ts        # [NEW] 独立 HLS 切片，每个 <5MB
│   │   │   └── ...
│   │   ├── video-muted/
│   │   │   ├── index.m3u8       # [MODIFY] 重新生成为独立分片格式
│   │   │   ├── seg000.ts        # [NEW]
│   │   │   └── ...
│   │   └── audio/               # 不变，已符合限制
│   ├── six-little-ducks-video.mp4        # [MODIFY] ffmpeg 压缩后 <25MB
│   └── six-little-ducks-video-muted.mp4  # [MODIFY] ffmpeg 压缩后 <25MB
└── Six_Little_Ducks.mp4    # 部署时排除（未被代码引用，节省体积）
```

## Agent Extensions

### MCP

- **github**
- Purpose: 压缩和重新切片完成后，将更新推送到 GitHub 仓库保持代码同步
- Expected outcome: 最新代码同步到 GitHub，Cloudflare Pages 后续可关联 GitHub 自动部署
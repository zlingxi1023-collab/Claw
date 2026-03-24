#!/bin/bash
# Six Little Ducks - 启动脚本
# 自动创建媒体软链接并启动本地 HTTP 服务器

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MEDIA_DIR="$SCRIPT_DIR/media"
PORT=8066

# 源文件路径
VIDEO_SRC="/Users/zhanglingxi/Documents/个人/sixduck/c2a9e430eab75fe34933965a5e0cbd55_raw.mp4"
AUDIO_SRC="/Users/zhanglingxi/Documents/个人/sixduck/Super Simple Songs-Six Little Ducks (Sing-Along).ogg"

echo "🦆 Six Little Ducks - 合唱表演系统"
echo "=================================="

# 创建 media 目录
mkdir -p "$MEDIA_DIR"

# 创建软链接（如果不存在）
if [ ! -L "$MEDIA_DIR/six-little-ducks.mp4" ]; then
  ln -sf "$VIDEO_SRC" "$MEDIA_DIR/six-little-ducks.mp4"
  echo "✅ 视频文件已链接"
fi

if [ ! -L "$MEDIA_DIR/six-little-ducks.ogg" ]; then
  ln -sf "$AUDIO_SRC" "$MEDIA_DIR/six-little-ducks.ogg"
  echo "✅ 音频文件已链接"
fi

echo ""
echo "🌐 启动本地服务器: http://localhost:$PORT"
echo "   按 Ctrl+C 停止服务器"
echo ""

# 启动 HTTP 服务器
cd "$SCRIPT_DIR"
python3 -m http.server $PORT

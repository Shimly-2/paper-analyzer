# Paper Analyzer

论文分析工具 - 支持 PDF 解析、AI 分析、论文翻译、语义搜索等功能。

## 功能特性

- 📚 论文库管理 - 本地存储论文元数据和标签
- 📖 阅读模式 - 清晰的论文阅读界面
- 🤖 AI 分析 - 使用 MiniMax API 进行论文分析和翻译
- 👥 同伴评审 - 生成论文评审意见
- 🔍 语义搜索 - 基于 Semantic Scholar 的论文搜索
- 📄 PDF 解析 - 使用 MinerU API 解析 PDF

## 环境配置

### 1. 克隆项目

```bash
git clone https://github.com/Shimly-2/paper-analyzer.git
cd paper-analyzer
```

### 2. 安装依赖

```bash
# Node.js 依赖
npm install

# Python 依赖（如果需要本地运行）
pip install -r requirements.txt
```

### 3. 配置 API Token

在 `config/minimax_token.txt` 中填入你的 MiniMax API Token。

## 项目启动

### 前端（GitHub Pages）

```bash
python3 -m http.server 8080
# 推送后自动部署到 GitHub Pages
# URL: https://shimly-2.github.io/paper-analyzer/
```

### 后端（本地运行）

```bash
node api/server.js
# 服务运行在 http://localhost:5001
```

```bash
ss -tlnp | grep 5001
```

### 使用 Tunnel 公开访问 no root

#### 方式 1：ngrok（推荐）

#### use tmux
```bash
# 安装 ngrok（如果未安装）
# 参考: https://ngrok.com/download

# 启动 tunnel
ngrok http 5001

# 获得公开 URL，格式如：
# https://xxxx.ngrok-free.dev
```

#### 方式 2：Cloudflare Tunnel

```bash
# 安装 cloudflared
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O cloudflared
chmod +x cloudflared

# 启动 tunnel
# https://dash.cloudflare.com/34bedebd3d69b4341719e07fde56e0a4/tunnels/62e8bb03-56a0-41d6-8502-f1d4fe37e580/overview
sudo cloudflared service uninstall
sudo cloudflared service install eyJhIjoiMzRiZWRlYmQzZDY5YjQzNDE3MTllMDdmZGU1NmUwYTQiLCJ0IjoiNjJlOGJiMDMtNTZhMC00MWQ2LTg1MDItZjFkNGZlMzdlNTgwIiwicyI6IlpEQmlPV013TVRndFl6STROUzAwTTJNeExXRmxNbVF0WkRJNU9HSmpNVEkzTVRKaSJ9

# 获得公开 URL，格式如：
# https://xxxx.trycloudflare.com
```

⚠️ **注意**：免费版 tunnel URL 可能会变化，重启后需要更新前端代码中的 API URL。

## API 配置

前端默认 API URL 在 `index.html` 中定义：

```javascript
const apiUrl = localStorage.getItem('apiUrl') || 'https://your-api-url.com';
```

可以在浏览器控制台动态修改：

```javascript
localStorage.setItem('apiUrl', 'https://your-new-url.com')
location.reload()
```

## 部署到 Railway（可选）

如果需要部署到 Railway，需要解决网络问题（MinerU API 可能无法访问）。

### Dockerfile 部署

1. 在 Railway 项目设置中将 Build 方式改为 **Docker**
2. 推送代码后自动构建

## 项目结构

```
paper-analyzer/
├── api/
│   └── server.js          # Node.js 后端服务
├── scripts/
│   └── mineru_client.py   # MinerU PDF 解析脚本
├── config/
│   └── minimax_token.txt # MiniMax API Token
├── index.html             # 前端页面
├── package.json           # Node 依赖
├── requirements.txt       # Python 依赖
└── Dockerfile             # Docker 配置
```

## 技术栈

- **前端**: HTML + CSS + JavaScript
- **后端**: Node.js + Express
- **AI**: MiniMax API
- **PDF 解析**: MinerU API
- **论文搜索**: Semantic Scholar API

## 注意事项

1. MiniMax API Token 需要自行申请
2. MinerU API 需要 Token（可在 MinerU 官网申请）
3. 本地运行时，确保 5001 端口未被占用
4. 使用 tunnel 时，需要保持终端运行

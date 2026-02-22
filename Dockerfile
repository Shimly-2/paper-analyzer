# 基础镜像：Node.js 18 slim版（Ubuntu底层）
FROM node:18-slim

# 核心：安装Python3 + pip3 + 依赖（解决"python not found"）
# 1. 加-y确保自动确认安装，加--no-install-recommends减小镜像体积
# 2. 建立软链接：让python=python3，pip=pip3（避免命令别名问题）
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    curl && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    ln -s /usr/bin/pip3 /usr/bin/pip && \
    # 清理缓存，减小镜像体积
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 复制package.json并安装Node依赖（先复制package.json可利用Docker缓存）
COPY package.json package-lock.json* ./
RUN npm install --production

# 复制Python依赖文件（如果有requirements.txt，必须加这步）
COPY requirements.txt* ./
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi

# 复制项目代码（按你的目录结构）
COPY api ./api
COPY scripts ./scripts
COPY config ./config

# 暴露端口（和Node服务一致）
EXPOSE 5001

# 启动命令：先验证Python/Node版本，再启动服务（方便排查）
CMD ["sh", "-c", "python --version && pip --version && node --version && node api/server.js"]

FROM node:18-slim

# 关键修正：先删原有链接，再创建新的，避免冲突
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    curl && \
    # 先删除已存在的python/pip链接（-f避免不存在时报错）
    rm -f /usr/bin/python /usr/bin/pip && \
    # 重新创建软链接
    ln -s /usr/bin/python3 /usr/bin/python && \
    ln -s /usr/bin/pip3 /usr/bin/pip && \
    # 清理缓存
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production

# 安装Python依赖（如果有requirements.txt）
COPY requirements.txt* ./
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi

COPY api ./api
COPY scripts ./scripts
COPY config ./config

EXPOSE 5001

# 启动命令：验证版本+启动服务
CMD ["sh", "-c", "python --version && pip --version && node --version && node api/server.js"]

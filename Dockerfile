FROM node:18-slim

# 1. 安装Python3 + python3-venv（必须，用于创建虚拟环境）+ curl
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    curl && \
    # 清理缓存
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 2. 创建Python虚拟环境（路径：/app/venv）
RUN python3 -m venv /app/venv

# 3. 激活虚拟环境，并安装Python依赖（核心：用venv的pip）
# 注：每次执行Python/pip命令都要先激活虚拟环境
ENV VIRTUAL_ENV=/app/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# 设置工作目录
WORKDIR /app

# 4. 安装Node依赖（不受影响）
COPY package.json package-lock.json* ./
RUN npm install --production

# 5. 安装Python依赖（用虚拟环境的pip，无系统限制）
COPY requirements.txt* ./
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi

# 6. 复制项目代码
COPY api ./api
COPY scripts ./scripts
COPY config ./config

EXPOSE 5001

# 7. 启动命令：验证虚拟环境中的Python/pip，再启动Node服务
# 注：PATH已包含虚拟环境，直接用python/pip即可
CMD ["sh", "-c", "python --version && pip --version && node --version && node api/server.js"]

FROM node:18-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 在创建虚拟环境后，添加验证
RUN python3 -m venv /app/venv && \
    # 验证虚拟环境是否存在python可执行文件
    ls -l /app/venv/bin/python && \
    # 验证虚拟环境的python版本
    /app/venv/bin/python --version

ENV VIRTUAL_ENV=/app/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY requirements.txt* ./
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi

COPY api ./api
COPY scripts ./scripts
COPY config ./config

EXPOSE 5001

CMD ["sh", "-c", "echo $PATH && which python && /app/venv/bin/python --version && node api/server.js"]

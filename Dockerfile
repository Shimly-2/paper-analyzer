FROM node:18-slim

RUN apt-get update && apt-get install -y python3 python3-pip curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install

COPY api ./api
COPY scripts ./scripts
COPY config ./config

EXPOSE 3000

CMD ["node", "api/server.js"]

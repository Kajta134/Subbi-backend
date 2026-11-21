FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DB_PATH=/data/subbi.db

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

# Baza SQLite na wolumenie, żeby przetrwała restart / aktualizację kontenera.
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node

EXPOSE 3000
CMD ["node", "src/server.ts"]

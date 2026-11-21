# --- Build: kompilacja NestJS (wygenerowany klient Prismy trafia do dist/generated) ---
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# --- Runtime: tylko zależności produkcyjne (w tym Prisma CLI do migracji) ---
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATABASE_URL=file:/data/subbi.db

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

# Baza SQLite na wolumenie, żeby przetrwała restart / aktualizację kontenera.
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node

EXPOSE 3000
# Migracje przy każdym starcie (bezpieczne – stosuje tylko nowe), potem serwer.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]

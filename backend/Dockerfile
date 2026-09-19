# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS dependencies

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci


FROM dependencies AS build

ENV DATABASE_URL=postgresql://build:build@localhost:5432/build?schema=public

COPY prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN npm run build


FROM dependencies AS migrate

COPY prisma.config.ts ./
COPY prisma ./prisma

CMD ["npm", "run", "db:migrate:deploy"]


FROM build AS seed

CMD ["npm", "run", "db:seed"]


FROM node:24-bookworm-slim AS production

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

USER node

EXPOSE 3001

CMD ["node", "dist/server.js"]

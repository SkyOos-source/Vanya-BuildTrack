FROM node:22-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY backend/prisma ./backend/prisma
COPY frontend/package.json ./frontend/package.json
RUN npm ci

COPY backend ./backend
COPY frontend ./frontend
RUN npm run build \
  && mkdir -p backend/public \
  && cp -a frontend/dist/. backend/public/

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/public ./backend/public
RUN mkdir -p backend/data && chown -R node:node backend

USER node
EXPOSE 3001

CMD ["npm", "run", "start", "--workspace", "@buildtrack/backend"]

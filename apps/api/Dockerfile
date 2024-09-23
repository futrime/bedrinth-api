FROM node:20.17.0-alpine3.20 AS builder
WORKDIR /app
COPY . .
RUN npm ci \
 && npm run build

FROM node:20.17.0-alpine3.20 AS runner-base
WORKDIR /app
COPY package.json package-lock.json /app/
RUN npm ci --omit=dev

FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
COPY package.json package-lock.json /app/
COPY --from=builder /app/dist /app/dist
COPY --from=runner-base /app/node_modules /app/node_modules
ENV NODE_ENV=production
ENTRYPOINT ["/nodejs/bin/node", "dist/index.js"]
EXPOSE 80

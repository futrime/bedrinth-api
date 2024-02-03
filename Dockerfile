FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY . .

RUN npm ci \
 && npm run build

FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package.json package-lock.json ./

RUN npm ci

COPY --from=builder /usr/src/app/dist ./dist

CMD ["npm", "start"]

EXPOSE 80

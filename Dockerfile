# syntax=docker/dockerfile:1

FROM node:18-alpine
WORKDIR /app

COPY . .
RUN npm install --production --silent

ENV NODE_ENV=production
CMD ["npm", "start"]
EXPOSE 80

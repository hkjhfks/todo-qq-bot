FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src
COPY patch-ed25519.js ./patch-ed25519.js
RUN node patch-ed25519.js

# 如需在镜像内内置 .env，可取消注释：
# COPY .env .env

CMD ["npm", "start"]

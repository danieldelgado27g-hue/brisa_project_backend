FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS dev
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]

FROM base AS production
COPY . .
EXPOSE 3000
USER node
CMD ["node", "server.js"]

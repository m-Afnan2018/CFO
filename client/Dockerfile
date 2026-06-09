FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
# API_ORIGIN must be set at build time so next.config.js rewrites compile correctly
ARG API_ORIGIN=http://cfo_backend:5000
ENV API_ORIGIN=$API_ORIGIN
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
# next.config.js is re-read at server startup — needed for runtime rewrites
COPY --from=builder /app/next.config.js ./next.config.js
COPY package*.json ./
EXPOSE 3000
CMD ["npm", "start"]

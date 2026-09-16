# Multi-stage production build for Sona
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build Vite production bundle
RUN npm run build

# Production runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install lightweight static file server with SPA routing support
RUN npm install -g serve

# Copy built frontend assets
COPY --from=builder /app/dist ./dist

# Railway default port
EXPOSE 8080
EXPOSE 3000

# Start static server binding to 0.0.0.0 and dynamic $PORT with SPA fallback (-s)
CMD ["sh", "-c", "serve -s dist -l tcp://0.0.0.0:${PORT:-8080}"]

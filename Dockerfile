# =============================================================================
# FGD (Fully-Grounded Digital) - Minecraft NPC Swarm Management System
# Multi-stage Production Dockerfile
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder - Install dependencies and prepare application
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

LABEL maintainer="FGD Team"
LABEL description="Minecraft NPC Swarm Management System"
LABEL version="2.1.0"

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (production only for smaller image)
# Use npm ci for reproducible builds
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application source
COPY . .

# Remove development files
RUN rm -rf test/ docs/ .git/ .github/ *.md || true

# -----------------------------------------------------------------------------
# Stage 2: Production - Minimal runtime image
# -----------------------------------------------------------------------------
FROM node:20-alpine

# Install dumb-init for proper signal handling (PID 1 problem)
# tini is an alternative: RUN apk add --no-cache tini
RUN apk add --no-cache dumb-init

# Create app user (non-root for security)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy node_modules from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application from builder
COPY --from=builder --chown=nodejs:nodejs /app .

# Create necessary directories with proper permissions
RUN mkdir -p logs data && \
    chown -R nodejs:nodejs logs data

# Environment variables (can be overridden)
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 3000

# Health check - verify server is responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/v1/cluster/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1))"

# Use dumb-init to handle signals properly
# This ensures graceful shutdown when container stops
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "server.js"]

# =============================================================================
# Build Instructions:
# =============================================================================
# Build:
#   docker build -t fgd-app:latest .
#   docker build -t fgd-app:2.1.0 .
#
# Run standalone:
#   docker run -d \
#     -p 3000:3000 \
#     -e DATABASE_URL=postgresql://user:pass@host:5432/dbname \
#     -e REDIS_URL=redis://host:6379 \
#     -e JWT_SECRET=your_secret_here \
#     -e OPENAI_API_KEY=your_key_here \
#     --name fgd-app \
#     fgd-app:latest
#
# Run with docker-compose:
#   docker-compose up -d
#
# =============================================================================
# Image Size Optimization:
# =============================================================================
# - Multi-stage build removes build dependencies
# - Alpine base image (~5MB vs ~900MB for full node image)
# - Production dependencies only
# - Removed dev files, docs, tests
# Expected final image size: ~150-200MB
#
# =============================================================================
# Security Features:
# =============================================================================
# - Non-root user (nodejs:nodejs, UID 1001)
# - Minimal attack surface (Alpine Linux)
# - dumb-init prevents zombie processes
# - Health check for container orchestration
# - No unnecessary packages
#
# =============================================================================

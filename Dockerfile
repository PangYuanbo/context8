# ErrorSolver MCP Server Dockerfile
# Note: ErrorSolver primarily uses stdio transport and local SQLite storage
# This Dockerfile is provided for containerization but not required for typical use

# ----- Build Stage -----
FROM node:lts-alpine AS builder
WORKDIR /app

# Copy package files
COPY package.json package-lock.json tsconfig.json ./

# Copy source code
COPY src ./src

# Install dependencies and build
RUN npm ci && npm run build

# ----- Production Stage -----
FROM node:lts-alpine
WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/dist ./dist

# Copy package.json for production install
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --production --ignore-scripts

# Create directory for SQLite database
RUN mkdir -p /root/.errorsolver

# Volume for persistent database storage
VOLUME /root/.errorsolver

# Default command (stdio transport)
CMD ["node", "dist/index.js"]

# Note: This container uses stdio transport by default
# Mount your database volume: -v ~/.errorsolver:/root/.errorsolver

# --- Stage 1: Build the Vue Frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/client

# Copy client config and install deps
COPY client/package*.json ./
RUN npm install

# Copy source and build
COPY client/ .
RUN npm run build

# --- Stage 2: Setup the Server ---
FROM node:20-alpine
WORKDIR /app/server

# Copy server config and install deps
COPY server/package*.json ./
RUN npm install --production

# Copy server source code
COPY server/ .

# Copy the built frontend from Stage 1 into the location server.js expects
# server.js looks for '../client/dist', so we put it in /app/client/dist
COPY --from=frontend-builder /app/client/dist ../client/dist

# Expose the port defined in server.js
EXPOSE 4001

# Start the server
CMD ["node", "server.js"]
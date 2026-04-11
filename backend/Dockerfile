FROM node:20-alpine

WORKDIR /app

# Install build deps for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY src/ ./src/

# Create directories for persistent data
RUN mkdir -p data uploads

EXPOSE 3001

CMD ["node", "src/server.js"]

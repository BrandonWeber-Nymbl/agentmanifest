FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY registry/package*.json ./
COPY registry/tsconfig.json ./

# Copy Prisma schema
COPY registry/prisma/ ./prisma/

# Install dependencies
RUN npm install

# Generate Prisma client
RUN npm run prisma:generate

# Copy source code
COPY registry/src/ ./src/

# Build
RUN npm run build

# Expose port
EXPOSE 3002

# Start server (migrations run in docker-compose command)
CMD ["npm", "start"]

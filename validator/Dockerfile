FROM node:18-alpine

WORKDIR /app

# Copy spec directory first (from root context)
COPY spec/ ./spec/

# Copy package files
COPY validator/package*.json ./
COPY validator/tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY validator/src/ ./src/

# Build
RUN npm run build

# Expose port
EXPOSE 3001

# Start server
CMD ["npm", "run", "start:web"]
